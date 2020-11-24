const Message = require('../../models/message.js');

var fakeDatabase = {};

const Resolvers = {
  Query: {
    getMessage: (root, {id}, context) => {
      if (!fakeDatabase[id]) { throw new Error('no message exists with id ' + id); }
      return new Message(id, fakeDatabase[id]);
    },
  },
  Mutation: {
    createMessage: (root, {input}, context) => {
      var id = require('crypto').randomBytes(10).toString('hex');
      fakeDatabase[id] = input;
      return new Message(id, input);
    },
    updateMessage: (root, {id, input}, context) => {
      if (!fakeDatabase[id]) { throw new Error('no message exists with id ' + id); }
      fakeDatabase[id] = input;
      return new Message(id, input);
    },
  },
};

module.exports = Resolvers;