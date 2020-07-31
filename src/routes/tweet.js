const router = require("express").Router();
const {
  addTweet,
  likeTweet,
  unlikeTweet,
  addRetweet,
  removeRetweet,
  getTweet
} = require("../controllers/tweet");

router.post("/add-tweet", addTweet);
router.post("/like/add", likeTweet);
router.delete("/like/remove", unlikeTweet);
router.post("/retweet/add", addRetweet);
router.delete("/retweet/remove", removeRetweet);
router.get('/get-tweet', getTweet);

module.exports = router;
