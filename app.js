import bluebird from 'bluebird'
import {default as faker} from 'faker'
import _ from 'lodash'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });

const USERS_COUNT = 10000
const GROUPS_COUNT = 1000
const POSTS_PER_USER_MIN = 0
const POSTS_PER_USER_MAX = 5000
const POSTS_CREATION_CHUNK = 5
const FRIENDS_PER_USER_MIN = 5
const FRIENDS_PER_USER_MAX = 500
const HIDES_PER_USER_MIN = 5
const HIDES_PER_USER_MAX = 500
const GROUPS_PER_USER_MIN = 0
const GROUPS_PER_USER_MAX = 20
const POST_LIKES_MIN = 0
const POST_LIKES_MAX = 50
const POST_COMMENTS_MIN = 0
const POST_COMMENTS_MAX = 50
const POST_HIDES_MIN = 0
const POST_HIDES_MAX = 50
const HOME_FEED_POSTS_LIMIT = 30
const HOME_FEED_POSTS_FROM_DATE = '2016-01-01'
let globalPostsCount = 0
let globalLikesCount = 0
let globalCommentsCount = 0
let globalPostHidesCount = 0
const userIdsRange  = _.range(1, USERS_COUNT + 1)
const groupIdsRange = _.range(1, GROUPS_COUNT + 1)
const testedHomeFeedsCount = userIdsRange.length -1

async function app() {
  let promises

  await DbCleaner.clean()

  console.time('create_users')
  promises = userIdsRange.map((id)=>{
    return createUser()
  })
  await Promise.all(promises)
  console.timeEnd('create_users')


  console.time('create_base_feeds')
  promises = userIdsRange.map((id)=>{
    const isPublic = (id % 10) !== 0
    const payload = {type: 'base', is_public: isPublic}
    return createFeed(payload)
  })
  await Promise.all(promises)
  console.timeEnd('create_base_feeds')


  console.time('create_group_feeds')
  promises = groupIdsRange.map((id)=>{
    return createFeed({type: 'group'})
  })
  const groupIds = await Promise.all(promises)
  console.timeEnd('create_group_feeds')


  console.time('create_comment_feeds')
  promises = userIdsRange.map((id)=>{
    return createFeed({type: 'comments'})
  })
  await Promise.all(promises)
  console.timeEnd('create_comment_feeds')


  console.time('create_like_feeds')
  promises = userIdsRange.map((id)=>{
    return createFeed({type: 'likes'})
  })
  await Promise.all(promises)
  console.timeEnd('create_like_feeds')


  console.time('create_hides_feeds')
  promises = userIdsRange.map((id)=>{
    return createFeed({type: 'hides'})
  })
  await Promise.all(promises)
  console.timeEnd('create_hides_feeds')


  console.time('subscribe_user_to_own_feeds')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToOwnFeeds(id)
  })
  await Promise.all(promises)
  console.timeEnd('subscribe_user_to_own_feeds')


  console.time('subscribe_user_to_groups')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToRandomGroups(id, groupIds)
  })
  const subscribedGroupsCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_groups')
  const averageGroupsSubscribed = _.reduce(subscribedGroupsCount, (res, val) => {
    return res + val
  }, 0) / subscribedGroupsCount.length


  console.time('subscribe_user_to_users')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToRandomUsers(id, _.without(userIdsRange, id))
  })
  const subscribedUsersCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_users')
  const averageUsersSubscribed = _.reduce(subscribedUsersCount, (res, val) => {
      return res + val
    }, 0) / subscribedUsersCount.length


  console.time('hide_random_feeds')
  promises = userIdsRange.map((id)=>{
    return hideRandomFeeds(id)
  })
  const hiddenFeedsCount = await Promise.all(promises)
  console.timeEnd('hide_random_feeds')
  const averageFeedsHidden = _.reduce(hiddenFeedsCount, (res, val) => {
      return res + val
    }, 0) / hiddenFeedsCount.length


  console.log("Creating posts")
  console.time('create_posts')
  await createPosts(userIdsRange)
  console.timeEnd('create_posts')

  let postsCount = await countEntries('posts')
  const averagePostsCount = globalPostsCount / USERS_COUNT
  const averageLikesPerPost = globalLikesCount / postsCount
  const averageCommentsPerPost = globalCommentsCount / postsCount
  const averageHidesPerPost = globalPostHidesCount / postsCount



  let count
  count = await countEntries('users')
  console.log(`Users created: ${count}`)

  count = await countEntries('feeds', {type: 'base'})
  console.log(`Base feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'base', is_public: false})
  console.log(`Private base feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'group'})
  console.log(`Groups created: ${count}`)

  count = await countEntries('feeds', {type: 'comments'})
  console.log(`Comments feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'likes'})
  console.log(`Likes feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'hides'})
  console.log(`Hides feeds created: ${count}`)

  console.log(`User average subscribed to ${averageGroupsSubscribed} groups`)
  console.log(`User average subscribed to ${averageUsersSubscribed} users`)
  console.log(`Average feeds hidden (per user): ${averageFeedsHidden}`)

  console.log(`Posts created: ${postsCount}`)

  console.log(`User average created ${averagePostsCount} posts`)

  console.log(`Post have average ${averageLikesPerPost} likes`)

  console.log(`Post have average ${averageCommentsPerPost} comments`)

  console.log(`Post average hidden by ${averageHidesPerPost} users`)

  console.time('create_indexes')
  await createDbIndexes()
  console.timeEnd('create_indexes')

  console.log("Getting home feeds")
  console.time('get_home_feeds')
  console.log(await getUserHomeFeeds(userIdsRange))
  console.timeEnd('get_home_feeds')


  //await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})


async function createUser(){
  return knex('users').returning('id').insert({})
}

async function findUser(id){
  let res = await knex('users').where({id: id})
  return res[0]
}

async function getUserHomeFeeds(userIdsRange){
  process.stdout.write('.')
  let userId = userIdsRange[0]
  let [minTime, minPosts, minSubscrFeeds] = await getUserHomeFeed(userId)
  let [maxTime, maxPosts, maxSubscrFeeds] = [minTime, minPosts, minSubscrFeeds]
  for (let i = 1; i < testedHomeFeedsCount; i += 1){
    process.stdout.write('.')
    let userId = userIdsRange[_.random(1, userIdsRange.length - 1)]
    let [time, postCount, subscribedFeedsCount]= await getUserHomeFeed(userId)

    if (time[0] >= maxTime[0] && time[1] >= maxTime[1]){
      maxTime = time
    }

    if (time[0] <= minTime[0] && time[1] <= minTime[1]){
      minTime = time
    }

    if (postCount > maxPosts){
      maxPosts = postCount
    }

    if (postCount < minPosts){
      minPosts = postCount
    }

    if (subscribedFeedsCount > maxSubscrFeeds){
      maxSubscrFeeds = subscribedFeedsCount
    }

    if (subscribedFeedsCount < minSubscrFeeds){
      minSubscrFeeds = subscribedFeedsCount
    }
  }
  console.log()
  return {
    time: {
      min: minTime,
      max: maxTime
    },
    posts: {
      min: minPosts,
      max: maxPosts
    },
    feeds: {
      min: minSubscrFeeds,
      max: maxSubscrFeeds
    }
  }
}

async function getUserHomeFeed(userId){
  const start = process.hrtime()
  const user = await findUser(userId)
  const feedIds = _.sortBy(user.subscr_feed_ids)
  const hiddenFeedIds = _.sortBy(user.hidden_feed_ids)
  const entries = await getPostsByFeedIds(feedIds, hiddenFeedIds)
  const finish = process.hrtime(start)
  const finishTime = [finish[0], finish[1] * Math.pow(10, -6)]
  return [finishTime, entries.length, feedIds.length]
}

async function subscribeUserToRandomGroups(userId, groupIds){
  const subscrCount = _.random(GROUPS_PER_USER_MIN, GROUPS_PER_USER_MAX)
  const subscribedGroups = _.sample(groupIds, subscrCount)

  await addValuesToIntarrayField('users', userId, 'subscr_feed_ids', subscribedGroups)
  return subscrCount
}

async function subscribeUserToOwnFeeds(userId){
  let feedsIds = getUserFeedsIds(userId)
  await addValuesToIntarrayField('users', userId, 'hidden_feed_ids', [feedsIds.hides])
  return addValuesToIntarrayField('users', userId, 'subscr_feed_ids', [feedsIds.own, feedsIds.comments, feedsIds.likes])
}

async function subscribeUserToRandomUsers(userId, userIds){
  const subscrCount = _.random(FRIENDS_PER_USER_MIN, FRIENDS_PER_USER_MAX)
  const subscribedUsers = _.sample(userIds, subscrCount)
  let feedIds = subscribedUsers.map((id) => {
    return getUserFeedsIds(id)
  }).reduce((res, val) => {
    res.push(val.own)
    res.push(val.comments)
    res.push(val.likes)
    return res
  }, [])

  await addValuesToIntarrayField('users', userId, 'subscr_feed_ids', feedIds)
  return subscrCount
}

async function hideRandomFeeds(userId){
  const hideCount = _.random(HIDES_PER_USER_MIN, HIDES_PER_USER_MAX)
  let hiddenFeedsIds = []
  for (let i = 0; i < hideCount; i+=1){
    hiddenFeedsIds.push(_.random(3 * USERS_COUNT + GROUPS_COUNT, 4 * USERS_COUNT + GROUPS_COUNT))
  }
  hiddenFeedsIds = _.without(hiddenFeedsIds, userId, getUserCommentsFeedId(userId), getUserLikesFeedId(userId))

  await addValuesToIntarrayField('users', userId, 'hidden_feed_ids', hiddenFeedsIds)
  return hideCount
}

async function getFeedSubscribersIds(feedId){
  let res = await knex.raw(`SELECT id FROM users WHERE users.subscr_feed_ids @> '{${feedId}}'`)
  return res.rows.map((r)=>{return r.id})
}

async function likePost(userId, postId){
  const likesFeedId = getUserLikesFeedId(userId)
  return addValuesToIntarrayField('posts', postId, 'feed_ids', [likesFeedId])
}

async function commentPost(userId, postId){
  const commentsFeedId = getUserCommentsFeedId(userId)
  return addValuesToIntarrayField('posts', postId, 'feed_ids', [commentsFeedId])
}


async function createFeed(payload){
  return knex('feeds').returning('id').insert(payload)
}

async function findFeed(id){
  let res = await knex('feeds').where({id: id})
  return res[0]
}

function isFeedBase(feedId){
  return feedId >= 1 && feedId <= USERS_COUNT
}

function isFeedPrivate(feedId){
  return feedId % 10 == 0
}

function isFeedBaseAndPrivate(feedId){
  return isFeedBase(feedId) && isFeedPrivate(feedId)
}

async function createPost(payload){
  return knex('posts').insert(payload)
}

async function findPost(id){
  let res = await knex('posts').where({id: id})
  return res[0]
}

async function getPostsByFeedIds(feedIds, hiddenFeedIds){
  const d = new Date(Date.parse(HOME_FEED_POSTS_FROM_DATE))
  return knex('posts').select('id', 'is_public', 'created_at').orderBy('created_at', 'desc').limit(HOME_FEED_POSTS_LIMIT).whereRaw('created_at > ?  and feed_ids && ? and not feed_ids && ?', [d, feedIds, hiddenFeedIds])
}

async function createPosts(userIdsRange){
  let chunks = _.chunk(userIdsRange, POSTS_CREATION_CHUNK)
  let promises = []
  for (let i = 0; i < chunks.length; i += 1){
    process.stdout.write('.')
    let chunk = chunks[i]
    promises = chunk.map((userId)=>{
      return createUserPosts(userId)
    })

    await Promise.all(promises)
  }
  console.log()
  return true
}

async function createUserPosts(userId){
  const postCount = _.random(POSTS_PER_USER_MIN, POSTS_PER_USER_MAX)
  globalPostsCount += postCount

  let payloads = []
  for (let i = 0; i < postCount; i += 1) {
    payloads.push(createPostPayload(userId))
  }

  return createPost(payloads)
}

function createPostPayload(userId){
  let feedId = userId
  const rand = Math.random()

  if (rand >= 0.8){
    feedId = _.sample(groupIdsRange)
  }

  const isPublic = !isFeedBaseAndPrivate(feedId)
  const createdAt = faker.date.past()
  let feedIds = [feedId]

  let likesCount = _.random(POST_LIKES_MIN, POST_LIKES_MAX)
  let commentsCount = _.random(POST_COMMENTS_MIN, POST_COMMENTS_MAX)
  let hidesCount = _.random(POST_HIDES_MIN, POST_HIDES_MAX)
  globalLikesCount += likesCount
  globalCommentsCount += commentsCount
  globalPostHidesCount += hidesCount
  let randomUserId = null
  for (let i = 0; i < likesCount; i += 1){
    randomUserId = userIdsRange[Math.floor(Math.random()*userIdsRange.length)]
    feedIds.push(getUserLikesFeedId(randomUserId))
  }
  for (let i = 0; i < commentsCount; i += 1){
    randomUserId = userIdsRange[Math.floor(Math.random()*userIdsRange.length)]
    feedIds.push(getUserCommentsFeedId(randomUserId))
  }
  for (let i = 0; i < hidesCount; i += 1){
    randomUserId = userIdsRange[Math.floor(Math.random()*userIdsRange.length)]
    feedIds.push(getUserHidesFeedId(randomUserId))
  }
  feedIds = _.sortBy(feedIds)

  return {
    is_public: isPublic,
    created_at: createdAt,
    feed_ids: feedIds
  }
}

async function countEntries(tableName, query = {}){
  const res = await knex(tableName).where(query).count()
  return res[0].count
}

function addValuesToIntarrayField(tableName, entryId, fieldName, values){
  if (!_.isArray(values)){
    throw new Error("values should be array")
  }
  return knex.raw(`UPDATE ${tableName} SET ${fieldName} = uniq(${fieldName} + ?) WHERE id = ?`, [values, entryId])
}

function getUserFeedsIds(userId){
  return {
    own:      userId,
    comments: getUserCommentsFeedId(userId),
    likes:    getUserLikesFeedId(userId),
    hides:    getUserHidesFeedId(userId)
  }
}

function getUserLikesFeedId(userId){
  return USERS_COUNT + GROUPS_COUNT + USERS_COUNT + userId
}

function getUserCommentsFeedId(userId){
  return USERS_COUNT + GROUPS_COUNT + userId
}

function getUserHidesFeedId(userId){
  return USERS_COUNT + GROUPS_COUNT + USERS_COUNT + USERS_COUNT + userId
}


async function createDbIndexes(){
  let promises = [
    knex.raw("CREATE INDEX IF NOT EXISTS posts_feed_ids_idx ON posts USING gin (feed_ids)"),
    knex.raw("CREATE INDEX IF NOT EXISTS posts_is_public_idx ON posts USING btree (is_public)"),
    knex.raw("CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts USING btree (created_at)"),
    knex.raw("CREATE INDEX IF NOT EXISTS users_hidden_feed_ids_idx ON users USING gin (hidden_feed_ids)"),
    knex.raw("CREATE INDEX IF NOT EXISTS users_subscr_feed_ids_idx ON users USING gin (subscr_feed_ids)"),
    knex.raw("CREATE INDEX IF NOT EXISTS feeds_is_public_idx ON feeds USING btree (is_public)"),
    knex.raw("CREATE INDEX IF NOT EXISTS feeds_type_idx ON feeds USING btree (type)")
  ]
  return Promise.all(promises)
}
