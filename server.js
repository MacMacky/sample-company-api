const restify = require('restify');
const r = require('rethinkdb');


const port = 3000;
const server = restify.createServer();

/* Helpers */
const isString = val => typeof val === 'string';
/* Helpers End */

/* Response */
const invalid_data = 'invalid data provided.';
const invalid_role = 'role not valid!';
const invalid_id = 'Invalid id!';
const id_does_not_exists = 'id does not exists.';
const internal_error = 'Internal Server Error';
/* Responses End */

const roles = ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'];

const loginRoute = async (req, res) => {
  let conn, roles_to_select, employees, user;
  try {

    /* check if login credentials are provided */
    if (!req.body.user_name || !req.body.password) {
      return res.send(400, { message: invalid_data });
    }
    /* initialize connection here */
    conn = await r.connect();
    [user] = await r.db('test').table('employees')
      .getAll(req.body.user_name, { index: 'user_name' })
      .coerceTo('array')
      .run(conn);

    if (!user) {
      return res.send(400, { message: 'user does not exists' });
    }

    const { password } = user;
    /* check if password is correct */
    if (password !== req.body.password) {
      return res.send(400, { message: 'wrong password. please try again.' });
    }

    /* get role for the specific user */
    const { role } = user;

    switch (role) {
      case 'ceo':
        roles_to_select = roles.slice(1);
        break;
      case 'president':
        roles_to_select = roles.slice(3);
        break;
      case 'hr':
        roles_to_select = roles.slice(4);
        break;
      case 'pm':
        roles_to_select = roles.slice(5);
        break;
      case 'senior developer':
        roles_to_select = roles.slice(6);
        break;
      default:
        roles_to_select = undefined;
        break;
    }

    if (roles_to_select) {
      employees = await r.db('test').table('employees')
        .getAll(...roles_to_select, { index: 'role' })
        .coerceTo('array')
        .run(conn);
    }

    res.send(200, { user, employees });
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
  let conn, user;
  try {

    /* check if user_name is provided */
    if (!req.body.user_name || !isString(req.body.user_name)) {
      return res.send(400, { message: invalid_data });
    }

    /* check if password is provided */
    if (!req.body.password || !isString(req.body.password)) {
      return res.send(400, { message: invalid_data });
    }

    /* check if full name is provided */
    if (!req.body.full_name || !isString(req.body.password)) {
      return res.send(400, { message: invalid_data });
    }

    /* check if role is provided */
    if (!req.body.role || !isString(req.body.role)) {
      return res.send(400, { message: invalid_data });
    }

    /* check if role is valid */
    if (!roles.includes(req.body.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

    /* initialize connection here */
    conn = await r.connect();

    [user] = await r.db('test').table('employees')
      .getAll(req.body.user_name, { index: 'user_name' })
      .coerceTo('array')
      .run(conn);

    /* check if user_name is taken */
    if (user) {
      return res.send(400, { message: 'user_name is already taken. please choose another one.' });
    }


    /* check if role of ceo and president is already taken */
    if (req.body.role.toLowerCase() === 'president' || req.body.role.toLowerCase() === 'ceo') {

      [user] = await r.db('test').table('employees')
        .getAll(req.body.role.toLowerCase(), { index: 'role' })
        .coerceTo('array')
        .run(conn);

      if (user && (user.role === 'president' || user.role === 'ceo')) {
        return res.send(400, { message: `role for ${user.role} is already taken. please try another one.` });
      }
    }

    const { first_error, generated_keys } = await r.db('test').table('employees')
      .insert({ ...req.body, role: req.body.role.toLowerCase() })
      .run(conn);


    return res.send(first_error ? 400 : 200,
      first_error ? { message: 'Cant insert data. Please try again later.' }
        : { ...req.body, role: req.body.role.toLowerCase(), id: generated_keys[0] });

  } catch (e) {
    console.log(e);
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


const updateUserRoute = async (req, res) => {
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
server.get('/api/employees/:id', getUsersRoute);
server.post('/api/employees', createUserRoute);
server.put('/api/employees/:id', updateUserRoute);
server.del('/api/employees/:id/role/:role', removeUserRoute);
server.get('*', (req, res) => res.send(404));
server.post('*', (req, res) => res.send(404));
server.put('*', (req, res) => res.send(404));
server.del('*', (req, res) => res.send(404));


const indexCreate = async (con, index_name, table_name = 'employees') => {
  return r.db('test').table(table_name).indexCreate(index_name).run(con);
};

server.listen(port, async () => {
  let conn;
  try {
    conn = await r.connect();
    const indexes_made = await r.db('test').table('employees').indexList().run(conn);
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