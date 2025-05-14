# Jet Lag The Game: Hide and Seek Map Generator

A tool to trivially generate interactive maps for viewing hiding possibilities in Jet Lag The Game's Hide and Seek. So far, the following questions have been implemented (see https://github.com/akshygupt/JetLagHideAndSeek/issues/9 for more):

- Radius
    - All
- Thermometer
    - All
- Matching
    - Same zone (i.e., same region or prefecture)
    - Same first letter of zone
    - Same nearest commercial airport
    - Same train line
    - Same nearest major city
    - Same length of station's name
    - Same first letter of train station name
    - Same nearest park
    - Same nearest amusement park
    - Same nearest zoo
    - Same nearest aquarium
    - Same nearest golf course
    - Same nearest museum
    - Same nearest movie theater
    - Same nearest hospital
    - Same nearest library
    - Same nearest foreign consulate
- Measuring
    - Distance to coastline
    - Distance to commercial airport
    - Distance to major city
    - Distance to high-speed rail
    - Distance to rail station
    - Distance to 7-Eleven
    - Distance to McDonald's
    - Distance to park
    - Distance to amusement park
    - Distance to zoo
    - Distance to aquarium
    - Distance to golf course
    - Distance to museum
    - Distance to movie theater
    - Distance to hospital
    - Distance to library
    - Distance to foreign consulate
- Tentacles
    - Zoo
    - Aquarium
    - Amusement Park
    - Museum
    - Hospital
    - Movie theater
    - Library

## Contributing

If anyone wants to help, please focus on one of the following or leave an issue with your request:

- [x] User interface
- [x] Custom map bounds (i.e. draw geoJSON which should be used for the bounds)
- [ ] Adding questions (https://github.com/akshygupt/JetLagHideAndSeek/issues/9 and https://github.com/akshygupt/JetLagHideAndSeek/issues/34)
- [ ] Refactoring code
- [ ] Tests (https://github.com/akshygupt/JetLagHideAndSeek/issues/36)
- [x] Hider menu (prevent conflicting information between hiders and seekers by adding a menu for hiders to automatically obtain answers)
- [x] Train station fetching (use Overpass to fetch train stations in the zone and automatically show them, https://github.com/akshygupt/JetLagHideAndSeek/issues/24)
- [x] Progressive web app (https://github.com/akshygupt/JetLagHideAndSeek/issues/1)

This project uses ESLint and Prettier for formatting/style. Before submitting a pull request/committing, please run `pnpm lint` for your code to be automatically fixed.

More documentation to come.
