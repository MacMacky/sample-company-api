const restify = require('restify');
const r = require('rethinkdb');


const port = 3000;
const server = restify.createServer();


/* RESPONSES */
const invalid_data = 'invalid data provided.';
const invalid_role = 'role not valid!';
const invalid_id = 'Invalid id!';
const id_does_not_exists = 'id does not exists.';
const internal_error = 'Internal Server Error';
/* RESPONSES */

const roles = ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'];

const loginRoute = async (req, res) => {
  let conn;
  try {

    /* check if login credentials are provided */
    if (!req.body.user_name || !req.body.password) {
      return res.send(400, { message: invalid_data });
    }

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const getUsersRoute = async (req, res) => {
  let conn;
  try {

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const createUserRoute = async (req, res) => {
  let conn;
  try {

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const removeUserRoute = async (req, res) => {
  let conn;
  try {

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}



server.use(restify.plugins.bodyParser());
server.post('/api/login', loginRoute);
server.get('/api/users/:role', getUsersRoute);
server.post('/api/users', createUserRoute);
server.del('/api/users/:id/role/:role', removeUserRoute);
server.get('*', (req, res) => res.send(404));
server.post('*', (req, res) => res.send(404));
server.put('*', (req, res) => res.send(404));
server.del('*', (req, res) => res.send(404));


const indexCreate = async (con, index_name, table_name = 'company_users') => {
  return r.db('test').table(table_name).indexCreate(index_name).run(con);
};

server.listen(port, () => {
  let conn;
  try {
    conn = await r.connect();
    const indexes_made = await r.db('test').table('company_users').indexList().run(conn);

    /* create indexes if they don't exist already */
    ['role', 'user_name'].filter(item => !indexes_made.includes(item))
      .forEach(index_name => indexCreate(conn, index_name)
        .then(console.log)
        .catch(({ msg }) => console.log(msg))
      );

  } catch (e) {
    console.log(e);
  } finally {
    conn && conn.close();
    console.log(`Server listening at port : ${port}`);
  }

});