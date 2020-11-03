const { request, gql } = require('graphql-request');
const query = gql`
  {
    helloworld {
      Greeter {
        SayHello(request: { name: "Duye" }) {
          message
        }
      }
    }
  }
`;
 
request('http://localhost:3000/graphql', query).then((data) => console.log(JSON.stringify(data)));
