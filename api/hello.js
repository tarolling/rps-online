export default function hello(request, response) {
  let who = 'anonymous';

  if (request.body && request.body.who) {
    who = request.body.who;
  } else if (request.query.who) {
    who = request.query.who;
  } else if (request.cookies.who) {
    who = request.cookies.who;
  }

  response.status(200).send(`Hello ${who}!`);
};