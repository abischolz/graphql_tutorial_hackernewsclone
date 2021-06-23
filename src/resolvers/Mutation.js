const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { APP_SECRET, getUserId } = require('../utils');

async function signup(parent, args, context, info) {
  //encrypt user's password w/bcrypt
  const password = await bcrypt.hash(args.password, 10);
  // using PrismaClient instance to store new user in db
  const user = await context.prisma.user.create({
    data: { ...args, password },
  });
  console.log('USER: ', user);
  // JSON token that will allow user access to their account
  const token = jwt.sign({ userId: user.id }, APP_SECRET);
  console.log('TOKEN: ', token);
  //send back token and user to fit AuthPayload from GraphQL schema
  return {
    token,
    user,
  };
}

async function login(parent, args, context, info) {
  // using PrismaClient to get user info - like sequelize.findOne()

  const user = await context.prisma.user.findUnique({
    where: {
      email: args.email,
    },
  });
  if (!user) {
    throw new Error('No such user found');
  }
  //checking to see if password is valid
  const valid = await bcrypt.compare(args.password, user.password);
  if (!valid) {
    throw new Error('Invalid password');
  }
  //sending back user + token
  const token = jwt.sign({ userId: user.id }, APP_SECRET);

  return {
    token,
    user,
  };
}

async function post(parent, args, context, info) {
  const { userId } = context;
  const newLink = await context.prisma.link.create({
    data: {
      url: args.url,
      description: args.description,
      postedBy: { connect: { id: userId } },
    },
  });
  context.pubsub.publish('NEW_LINK', newLink);
  return newLink;
}

async function vote(parent, args, context, info) {
  const userId = getUserId(context);

  const vote = await context.prisma.vote.findUnique({
    where: {
      linkId_userId: {
        linkId: Number(args.linkId),
        userId: userId,
      },
    },
  });
  if (Boolean(vote)) {
    throw new Error(`Already voted for link: ${args.linkId}`);
  }
  const newVote = context.prisma.vote.create({
    data: {
      user: { connect: { id: userId } },
      link: { connect: { id: Number(args.linkId) } },
    },
  });
  context.pubsub.publish('NEW_VOTE', newVote);

  return newVote;
}

module.exports = {
  signup,
  login,
  post,
  vote,
};
