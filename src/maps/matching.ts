import {
    hiderMode,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    questionModified,
} from "@/lib/context";
import {
    findAdminBoundary,
    findPlacesInZone,
    locationFirstTag,
    nearestToQuestion,
    prettifyLocation,
    trainLineNodeFinder,
} from "./api";
import * as turf from "@turf/turf";
import _ from "lodash";
import { geoSpatialVoronoi } from "./voronoi";
import { toast } from "react-toastify";
import osmtogeojson from "osmtogeojson";
import { holedMask, unionize } from "./geo-utils";
import type {
    HomeGameMatchingQuestions,
    MatchingQuestion,
    APILocations,
} from "@/lib/schema";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";

export const findMatchingPlaces = async (question: MatchingQuestion) => {
    switch (question.type) {
        case "airport": {
            return _.uniqBy(
                (
                    await findPlacesInZone(
                        '["aeroway"="aerodrome"]["iata"]', // Only commercial airports have IATA codes,
                        "Finding airports...",
                    )
                ).elements,
                (feature: any) => feature.tags.iata,
            ).map((x) =>
                turf.point([
                    x.center ? x.center.lon : x.lon,
                    x.center ? x.center.lat : x.lat,
                ]),
            );
        }
        case "major-city": {
            return (
                await findPlacesInZone(
                    '[place=city]["population"~"^[1-9]+[0-9]{6}$"]', // The regex is faster than (if:number(t["population"])>1000000)
                    "Finding cities...",
                )
            ).elements.map((x: any) =>
                turf.point([
                    x.center ? x.center.lon : x.lon,
                    x.center ? x.center.lat : x.lat,
                ]),
            );
        }
        case "custom-points": {
            return question.geo!;
        }
        case "aquarium-full":
        case "zoo-full":
        case "theme_park-full":
        case "museum-full":
        case "hospital-full":
        case "cinema-full":
        case "library-full":
        case "golf_course-full":
        case "consulate-full":
        case "kindergarten-full":
        case "school-full":
        case "church-full":
        case "pharmacy-full":
        case "police-full":
        case "fire_station-full":
        case "library-full":
        case "station-full":
        case "tram_stop-full":
        case "park-full": {
            const location = question.  type.split("-full")[0] as APILocations;

            const data = await findPlacesInZone(
                `[${locationFirstTag[location]}=${location}]`,
                `Finding ${prettifyLocation(location).toLowerCase()}s...`,
                "nwr",
                "center",
                [],
                60,
            );

            if (data.remark && data.remark.startsWith("runtime error")) {
                toast.error(
                    `Error finding ${prettifyLocation(
                        location,
                    ).toLowerCase()}s. Please enable hiding zone mode and switch to the Large Game variation of this question.`,
                );
                return [];
            }

            if (data.elements.length >= 1000) {
                toast.error(
                    `Too many ${prettifyLocation(
                        location,
                    ).toLowerCase()}s found (${data.elements.length}). Please enable hiding zone mode and switch to the Large Game variation of this question.`,
                );
                return [];
            }

              const response = turf.points([]);
          
              data.elements.forEach((element: any) => {
                  if (!element.tags["name"] && !element.tags["name:en"]) return;
          
                  if (element.lat && element.lon) {
                      const name = element.tags["name:en"] ?? element.tags["name"];
          
                      if (
                          response.features.find(
                              (feature: any) => feature.properties.name === name,
                          )
                      )
                          return;
          
                      response.features.push(
                          turf.point([element.lon, element.lat], {
                              name,
                          }),
                      );
                  }
          
                  if (!element.center || !element.center.lon || !element.center.lat)
                      return;
          
                  const name = element.tags["name:en"] ?? element.tags["name"];
          
                  if (
                      response.features.find(
                          (feature: any) => feature.properties.name === name,
                      )
                  )
                      return;
          
                  response.features.push(
                      turf.point([element.center.lon, element.center.lat], {
                          name,
                      }),
                  );
              });
          
            return response;

        }
    }
};

export const determineMatchingBoundary = _.memoize(
    async (question: MatchingQuestion) => {
        let boundary;
        let name;

        switch (question.type) {
            case "aquarium":
            case "zoo":
            case "theme_park":
            case "museum":
            case "hospital":
            case "cinema":
            case "library":
            case "golf_course":
            case "consulate":
            case "park":
            case "same-first-letter-station":
            case "same-length-station":
            case "same-train-line": {
                return false;
            }
            case "custom-zone": {
                boundary = question.geo;
                break;
            }
            case "zone": {
                boundary = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!boundary) {
                    toast.error("No boundary found for this zone");
                    throw new Error("No boundary found");
                }
                break;
            }
            case "letter-zone": {
                const zone = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!zone) {
                    toast.error("No boundary found for this zone");
                    throw new Error("No boundary found");
                }

                let englishName = zone.properties?.["name:en"];

                if (!englishName) {
                    const name = zone.properties?.name;

                    if (/^[a-zA-Z]$/.test(name[0])) {
                        englishName = name;
                    } else {
                        toast.error("No English name found for this zone");
                        throw new Error("No English name");
                    }
                }

                const letter = englishName[0].toUpperCase();

                boundary = turf.featureCollection(
                    osmtogeojson(
                        await findPlacesInZone(
                            `[admin_level=${question.cat.adminLevel}]["name:en"~"^${letter}.+"]`, // Regex is faster than filtering afterward
                            `Finding zones that start with the same letter (${letter})...`,
                            "relation",
                            "geom",
                            [
                                `[admin_level=${question.cat.adminLevel}]["name"~"^${letter}.+"]`,
                            ], // Regex is faster than filtering afterward
                        ),
                    ).features.filter(
                        (x): x is Feature<Polygon | MultiPolygon> =>
                            x.geometry &&
                            (x.geometry.type === "Polygon" ||
                                x.geometry.type === "MultiPolygon"),
                    ),
                );

                // It's either simplify or crash. Technically this could be bad if someone's hiding zone was inside multiple zones, but that's unlikely.
                boundary = unionize(
                    turf.simplify(boundary, {
                        tolerance: 0.001,
                        highQuality: true,
                        mutate: true,
                    }),
                );

                break;
            }
            case "airport":
            case "major-city":
            case "aquarium-full":
            case "zoo-full":
            case "theme_park-full":
            case "museum-full":
            case "hospital-full":
            case "cinema-full":
            case "library-full":
            case "golf_course-full":
            case "consulate-full":
            case "park-full":
            case "kindergarten-full":
            case "school-full":
            case "church-full":
            case "pharmacy-full":
            case "police-full":
            case "fire_station-full":
            case "library-full":
            case "station-full":
            case "tram_stop-full":
            case "custom-points": {
                const data = await findMatchingPlaces(question);

                const voronoi = geoSpatialVoronoi(data);
                const point = turf.point([question.lng, question.lat]);

                for (const feature of voronoi.features) {
                    if (turf.booleanPointInPolygon(point, feature)) {
                        boundary = feature;
                        name = feature.properties.site.properties.name;
                        break;
                    }
                }
                break;
            }
        }

        return {
            boundary,
            name,
        };
    },
    (question: MatchingQuestion & { geo?: unknown; cat?: unknown }) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            cat: question.cat,
            geo: question.geo,
            entirety: polyGeoJSON.get()
                ? polyGeoJSON.get()
                : mapGeoLocation.get(),
        }),
);

export const adjustPerMatching = async (
    question: MatchingQuestion,
    mapData: any,
    masked: boolean,
) => {
    if (mapData === null) return;

    if (question.same && masked) {
        throw new Error("Cannot be masked");
    } else if (!question.same && !masked) {
        throw new Error("Must be masked");
    }

    const matchingBoundary = await determineMatchingBoundary(question);

    if (matchingBoundary === false) {
        return mapData;
    }

    const {boundary, name} = matchingBoundary;

    if (question.same) {
        return turf.intersect(
            turf.featureCollection([unionize(mapData), boundary]),
        );
    } else {
        return turf.union(
            turf.featureCollection([...mapData.features, boundary]),
        );
    }
};

export const hiderifyMatching = async (question: MatchingQuestion) => {
    const $hiderMode = hiderMode.get();
    if ($hiderMode === false) {
        return question;
    }

    if (
        [
            "aquarium",
            "zoo",
            "theme_park",
            "museum",
            "hospital",
            "cinema",
            "library",
            "golf_course",
            "consulate",
            "park",
        ].includes(question.type)
    ) {
        const questionNearest = await nearestToQuestion(
            question as HomeGameMatchingQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            same: true,
            type: (question as HomeGameMatchingQuestions).type,
            drag: false,
            color: "black",
        });

        question.same =
            questionNearest.properties.name === hiderNearest.properties.name;

        return question;
    }

    if (
        question.type === "same-first-letter-station" ||
        question.type === "same-length-station" ||
        question.type === "same-train-line"
    ) {
        const hiderPoint = turf.point([
            $hiderMode.longitude,
            $hiderMode.latitude,
        ]);
        const seekerPoint = turf.point([question.lng, question.lat]);

        const places = osmtogeojson(
            await findPlacesInZone(
                "[railway=station]",
                "Finding train stations. This may take a while. Do not press any buttons while this is processing. Don't worry, it will be cached.",
                "node",
            ),
        ) as FeatureCollection<Point>;

        const nearestHiderTrainStation = turf.nearestPoint(hiderPoint, places);
        const nearestSeekerTrainStation = turf.nearestPoint(
            seekerPoint,
            places,
        );

        if (question.type === "same-train-line") {
            const nodes = await trainLineNodeFinder(
                nearestSeekerTrainStation.properties.id,
            );

            const hiderId = parseInt(
                nearestHiderTrainStation.properties.id.split("/")[1],
            );

            if (nodes.includes(hiderId)) {
                question.same = true;
            } else {
                question.same = false;
            }
        }

        const hiderEnglishName =
            nearestHiderTrainStation.properties["name:en"] ||
            nearestHiderTrainStation.properties.name;
        const seekerEnglishName =
            nearestSeekerTrainStation.properties["name:en"] ||
            nearestSeekerTrainStation.properties.name;

        if (!hiderEnglishName || !seekerEnglishName) {
            return question;
        }

        if (question.type === "same-first-letter-station") {
            if (
                hiderEnglishName[0].toUpperCase() ===
                seekerEnglishName[0].toUpperCase()
            ) {
                question.same = true;
            } else {
                question.same = false;
            }
        } else if (question.type === "same-length-station") {
            if (hiderEnglishName.length === seekerEnglishName.length) {
                question.same = true;
            } else {
                question.same = false;
            }
        }

        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    try {
        feature = holedMask(
            (await adjustPerMatching(question, $mapGeoJSON, false))!,
        );
    } catch {
        try {
            feature = await adjustPerMatching(
                question,
                {
                    type: "FeatureCollection",
                    features: [holedMask($mapGeoJSON)],
                },
                true,
            );
        } catch {
            return question;
        }
    }

    if (feature === null || feature === undefined) return question;

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

    if (turf.booleanPointInPolygon(hiderPoint, feature)) {
        question.same = !question.same;
    }

    return question;
};

export const matchingPlanningPolygon = async (question: MatchingQuestion) => {
    try {
        const matchingBoundary = await determineMatchingBoundary(question);

        if (matchingBoundary === false) {
            return false;
        }

        const {boundary, name} = matchingBoundary;

        questionModified((question.name = name))

        return turf.polygonToLine(boundary);
    } catch {
        return false;
    }
};
