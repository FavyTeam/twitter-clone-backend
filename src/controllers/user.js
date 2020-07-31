const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const { User, Tweet, Retweet, Like, sequelize } = require("../sequelize");
const { addUserValidation } = require("../utils/validation");

module.exports = {
  addUser: async (req, res) => {
    // Joi validation checks
    const validation = addUserValidation(req.body);
    if (validation.error)
      return res.status(400).json({ errors: validation.error.details });

    try {
      // Create password hash
      let saltRounds = 10;
      const hash = await bcrypt.hash(req.body.password, saltRounds);
      req.body.password = hash;

      // Add user to User model
      const user = await User.create(req.body);
      return res.status(200).json({ user });
    } catch (err) {
      let errors = [];
      console.log(err.errors);
      err.errors.map((e) => {
        if (e.path === "users.username" && e.validatorKey === "not_unique")
          errors.push("Username is taken");
        if (e.path === "users.email" && e.validatorKey === "not_unique")
          errors.push("Email id is already registered");
      });
      return res.status(400).json({ errors });
    }
  },
  editUser: async (req, res) => {
    try {
      const user = await User.update(req.body, { where: { id: req.body.id } });
      return res.status(200).json({ user });
    } catch (error) {
      return res.status(400).json({ errors: error });
    }
  },
  loginUser: async (req, res) => {
    const user = await User.findOne({
      where: {
        [Op.or]: [{ username: req.body.user }, { email: req.body.user }],
      },
    });
    if (!user)
      return res.status(401).json({ user: "Incorrect username/email" });

    const match = await bcrypt.compare(req.body.password, user.password);
    return match
      ? res.status(200).json({ user })
      : res.status(401).json({ password: "Incorrect password" });
  },
  getUserByUsername: async (req, res) => {
    const user = await User.findOne({
      where: {
        username: req.query.username,
      },
    });
    return res.status(200).json(user);
  },
  getTweetsByUserId: async (req, res) => {
    let tweets = await User.findAll({
      attributes: ["firstname", "lastname", "username", "avatar"],
      include: {
        model: Tweet,
        required: true,
        attributes: [
          "id",
          "text",
          "commentsCount",
          "retweetsCount",
          "likesCount",
          "createdAt",
        ],
        where: {
          userId: req.query.userId,
        },
      },
      raw: true,
    });
    const sql = `select retweets.tweetId from retweets inner join tweets on tweets.id=retweets.tweetId where retweets.userId='${req.query.userId}'`;
    let retweets = await User.findAll({
      attributes: ["firstname", "lastname", "username", "avatar"],
      include: {
        model: Tweet,
        required: true,
        attributes: [
          "id",
          "text",
          "commentsCount",
          "retweetsCount",
          "likesCount",
          "createdAt",
        ],
        where: {
          id: {
            [Op.in]: sequelize.literal(`(${sql})`),
          },
        },
      },
      raw: true,
    });
    retweets = retweets.map((retweet) => ({ ...retweet, isRetweet: true }));
    tweets = tweets.concat(retweets).sort((a, b) => b.createdAt - a.createdAt);
    res.status(200).json({ tweets });
  },
  getLikesByUserId: async (req, res) => {
    // body -> {userId, myId}
    /* 
      1. Get tweets liked by user and tweetIds retweeted and liked by me
      2. Add tweetIds of retweets and likes in 2 Sets
      3. Map over liked tweets to add selfRetweeted -> true and selfLiked -> true
    */

    Promise.all([
      module.exports.getLikedTweets(req.query.userId),
      module.exports.getMyRetweets(req.query.myId),
      module.exports.getMyLikes(req.query.myId),
    ]).then((values) => {
      let likedTweets = values[0];
      const retweetSet = new Set();
      const likeSet = new Set();
      values[1].map((tweet) => retweetSet.add(tweet.tweetId));
      values[2].map((tweet) => likeSet.add(tweet.tweetId));
      likedTweets = likedTweets.map((tweet) => {
        let deepCopy = { ...tweet };
        if (retweetSet.has(tweet["Tweets.id"])) deepCopy.selfRetweeted = true;
        if (likeSet.has(tweet["Tweets.id"])) deepCopy.selfLiked = true;
        return deepCopy;
      });
      return res.status(200).json({ tweets: likedTweets });
    });
  },
  getLikedTweets: async (userId) => {
    const sql = `select likes.tweetId from likes inner join users on users.id=likes.userId where users.id='${userId}'`;
    const tweets = await User.findAll({
      attributes: ["firstname", "lastname", "username", "avatar"],
      include: {
        model: Tweet,
        required: true,
        attributes: [
          "id",
          "text",
          "commentsCount",
          "retweetsCount",
          "likesCount",
          "createdAt",
        ],
        where: {
          id: {
            [Op.in]: sequelize.literal(`(${sql})`),
          },
        },
      },
      raw: true,
    });
    return tweets;
  },
  getMyRetweets: async (myId) => {
    const retweets = await Retweet.findAll({
      attributes: ["tweetId"],
      where: {
        userId: myId,
      },
      raw: true,
    });
    return retweets;
  },
  getMyLikes: async (myId) => {
    const likes = await Like.findAll({
      attributes: ["tweetId"],
      where: {
        userId: myId,
      },
      raw: true,
    });
    return likes;
  },
};
