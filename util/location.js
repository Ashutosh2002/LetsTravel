var geo = require("mapbox-geocoding");

const HttpError = require("../models/http-error");

const ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

async function getCoordsForAddress(address) {
  //   return {
  //     lat: 40.7484474,
  //     lng: -73.9871516,
  //   };

  geo.setAccessToken(`${ACCESS_TOKEN}`);

  const coordinates = await new Promise((resolve, reject) => {
    geo.geocode(
      "mapbox.places",
      `${encodeURIComponent(address)}`,
      function (err, geoData) {
        //   console.log(geoData.features[0].center);
        if (err) {
          throw new HttpError(
            "Could not load the location for this address.",
            422
          );
        }
        //   console.log(geoData.features[0].geometry.coordinates);
        resolve(geoData.features[0].geometry.coordinates);
      }
    );
  });

  if (!coordinates.length === 0) {
    const error = new HttpError(
      "Could not load the location for this address.",
      422
    );
    throw new HttpError("Could not load the location for this address.", 422);
  }
  //   console.log(coordinates);

  return {
    lat: coordinates[1],
    lng: coordinates[0],
  };
}

module.exports = getCoordsForAddress;
