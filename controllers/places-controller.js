const fs = require("fs");

const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

// let DUMMY_PLACES = [
//   {
//     id: "p1",
//     title: "Empire State Building",
//     description: "One of the most famous sky scrapers in the world!",
//     location: {
//       lat: 40.7484474,
//       lng: -73.9871516,
//     },
//     address: "20 W 34th St, New York, NY 10001",
//     creator: "u1",
//   },
// ];

const getPlaceById = async (req, res, next) => {
  // console.log("GET Request in Places");
  const placeId = req.params.pid; // {pid: 'p1}
  // const place = DUMMY_PLACES.find((p) => {
  //   return p.id === placeId;
  // });

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    // console.log(err.message);
    const error = new HttpError(
      "Something went wrong, could not find a place.",
      500
    );
    return next(error);
  }

  if (!place) {
    // return res
    //   .status(404)
    //   .json({ message: "Could not find a place for the provided id." });

    //Use second method of sending the error
    // const error = new Error("Could not find a place for the provided id.");
    // error.code = 404;
    // throw error;

    const error = new HttpError(
      "Could not find a place for the provided id.",
      404
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
  // place.toObject converts json to normal javascript object.
  // getters:true converts '_id' to 'id'
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // const places = DUMMY_PLACES.filter((p) => p.creator === userId);

  let places;
  try {
    places = await Place.find({ creator: userId }); // returns an array
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later.",
      500
    );
    return next(error);
  }

  if (!places || places.length === 0) {
    // return res
    //   .status(404)
    //   .json({ message: "Could not find a place for the provided user id." });

    // Use this method of sending the error
    // const error = new Error("Could not find a place for the provided user id.");
    // error.code = 404;
    // return next(error);

    return next(
      new HttpError("Could not find a places for the provided user id.", 404)
    );
  }

  res
    .status(200)
    .json({ places: places.map((place) => place.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // console.log(errors);
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
    // console.log(coordinates);
  } catch (error) {
    return next(error);
  }

  // const createdPlace = {
  //   id: uuidv4(), // Generates a unique id for every place
  //   title,
  //   description,
  //   location: coordinates,
  //   address,
  //   creator,
  // };
  //   console.log(id);

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    creator: req.userData.userId,
    image: req.file.path,
  });

  // DUMMY_PLACES.push(createdPlace);

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id.", 404);
    return next(error);
  }

  console.log(user);

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    console.log(err.message);
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // console.log(errors);
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  // const updatedPlace = { ...DUMMY_PLACES.find((p) => p.id === placeId) };
  // const placeIndex = DUMMY_PLACES.findIndex((p) => p.id === placeId);

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    console.log(err.message);
    const error = new HttpError(
      "Somethin went wrong, could not update place.",
      500
    );
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are not allowed to edit this place.", 401);
    return next(error);
  }
  // updatedPlace.title = title;
  // updatedPlace.description = description;

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    console.log(err.message);
    const error = new HttpError(
      "Something went wrong, could not update place.",
      500
    );
    return next(error);
  }

  // DUMMY_PLACES[placeIndex] = updatedPlace;

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;
  // if (!DUMMY_PLACES.find((p) => p.id === placeId)) {
  //   throw new HttpError("Could not find a place for that id.", 404);
  // }

  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find place for this id.", 404);
    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    // In deletePlace, creator is a whole user object because of populate method.
    const error = new HttpError(
      "You are not allowed to delete this place.",
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );
    return next(error);
  }
  // DUMMY_PLACES = DUMMY_PLACES.filter((p) => p.id !== placeId);

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place." });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
