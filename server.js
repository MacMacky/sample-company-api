const restify = require('restify');
const r = require('rethinkdb');
const Promise = require('bluebird');


const port = 3000;
const server = restify.createServer();
const roles = ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'];


/* Helpers */
const isString = val => typeof val === 'string';
const rolesToBeModifiedByRole = (role, operation = 'update') => {
  if (operation === 'update') {
    return {
      "ceo": roles, /*  ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'] */
      "president": roles.slice(2), /* ['president', 'hr', 'pm', 'senior developer', 'junior developer'] */
      "hr": roles.slice(3), /* [hr', 'pm', 'senior developer', 'junior developer'] */
      "pm": roles.slice(4), /* ['pm', 'senior developer', 'junior developer'] */
      "senior developer": roles.slice(5) /* ['senior developer', 'junior developer'] */
    }[role.toLowerCase()]
  } else {
    return {
      "ceo": roles, /*  ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'] */
      "president": roles.slice(3), /* [ 'hr', 'pm', 'senior developer', 'junior developer'] */
      "hr": roles.slice(4), /* ['pm', 'senior developer', 'junior developer'] */
      "pm": roles.slice(5), /* ['senior developer', 'junior developer'] */
      "senior developer": roles.slice(6), /* ['junior developer'] */
    }[role.toLowerCase()]
  }
}
/* Helpers End */

/* Response */
const invalid_data = 'invalid data provided.';
const invalid_role = 'role not valid!';
const invalid_id = 'Invalid id!';
const id_does_not_exists = 'id does not exists.';
const internal_error = 'Internal Server Error';
const invalid_update = `you don't have permission to update this employee.`;
const invalid_remove = `you don't have permission to remove this employee.`
/* Responses End */





const getUsersRoute = async (req, res) => {
  let conn, employees;
  try {

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* check if query `role` is in roles */
    if (req.query.role && !roles.includes(req.query.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

    /* check if query `role` has a value and use that value for the index */
    if (req.query.role) {
      employees = await r.table('users')
        .getAll(req.query.role.toLowerCase(), { index: 'role' })
        .coerceTo('array')
        .run(conn);
    } else {
      employees = await r.table('users')
        .coerceTo('array')
        .run(conn);
    }

    res.send(200, { employees });
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const loginRoute = async (req, res) => {
  let conn, roles_to_select, employees, user;
  try {

    /* check if login credentials are provided */
    if (!req.body.user_name || !req.body.password) {
      return res.send(400, { message: invalid_data });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    [user] = await r.table('users')
      .getAll(req.body.user_name, { index: 'user_name' })
      .coerceTo('array')
      .run(conn);


    /* check if user does not exists */
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

    roles_to_select = rolesToBeModifiedByRole(role, 'remove');
    /* ceo =  ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'] */
    /* president =  [ 'hr', 'pm', 'senior developer', 'junior developer'] */
    /* hr =  ['pm', 'senior developer', 'junior developer'] */
    /* pm =  ['senior developer', 'junior developer']  */
    /* senior developer = ['junior developer']  */


    if (roles_to_select) {
      employees = await r.table('users')
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


const getUsersByIdRoute = async (req, res) => {
  let conn;
  try {
    /* check if id is provided */
    if (!req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });


    const user = await r.table('users').get(req.params.id).run(conn);

    res.send(user ? 200 : 400, user || { message: id_does_not_exists });
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

    /* check if role is valid */
    if (!req.body.role || !isString(req.body.role) || !roles.includes(req.body.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    [user] = await r.table('users')
      .getAll(req.body.user_name, { index: 'user_name' })
      .coerceTo('array')
      .run(conn);

    /* check if user_name is taken */
    if (user) {
      return res.send(400, { message: 'user_name is already taken. please choose another one.' });
    }


    /* check if role of `ceo` or `president` is already taken */
    if (req.body.role.toLowerCase() === 'president' || req.body.role.toLowerCase() === 'ceo') {

      [user] = await r.table('users')
        .getAll(req.body.role.toLowerCase(), { index: 'role' })
        .coerceTo('array')
        .run(conn);

      if (user && (user.role === 'president' || user.role === 'ceo')) {
        return res.send(400, { message: `role for ${user.role} is already taken. please try another one.` });
      }
    }

    const { first_error, generated_keys } = await r.table('users')
      .insert({ ...req.body, role: req.body.role.toLowerCase() })
      .run(conn);


    return res.send(first_error ? 400 : 200,
      first_error ? { message: 'Cant insert data. Please try again later.' }
        : { ...req.body, role: req.body.role.toLowerCase(), id: generated_keys[0] });

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const removeUserByHigherUpRoute = async (req, res) => {
  let conn;
  try {

    /* check if id is provided */
    if (!req.params.employee_id || !req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });


    const [user, employee] = await Promise.all([
      r.table('users').get(req.params.id).run(conn),
      r.table('users').get(req.params.employee_id).run(conn),
    ]);

    /* check if `user` does not exists */
    if (!user) {
      return res.send(400, { message: id_does_not_exists });
    }

    /* check if `employee` does not exists */
    if (!employee) {
      return res.send(400, { message: `employee ${id_does_not_exists}` });
    }
    /* extract needed properties */
    const { role: user_role } = user;

    /* check if `user.role` is not an `hr`, `president`, and `ceo` */
    if (!roles.slice(0, 4).includes(user_role) || user_role === 'assistant') {
      return res.send(400, { message: invalid_remove });
    }

    /* updating `employee` here */
    const { first_error } = await r.table('users')
      .get(req.params.employee_id)
      .delete()
      .run(conn);

    res.send(first_error ? 400 : 200, first_error ? { message: "Unable to delete. Please try again later." } : undefined);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const updateUserRoute = async (req, res) => {
  let conn;
  try {

    /* check if id is provided */
    if (!req.params.id) {
      return res.send(400, { message: invalid_id });
    }


    /* check if `role` is provided and is not valid */
    if (req.body.role && !roles.includes(req.body.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });


    /* get `skipped` property to check if the user `id` exists */
    const { skipped } = await r.table('users')
      .get(req.params.id)
      .update(req.body)
      .run(conn)

    res.send(skipped ? 400 : 200, skipped ? { message: id_does_not_exists } : req.body);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close()
  }
}

const updateUserByHigherUpRoute = async (req, res) => {
  let conn, employees_that_can_be_updated;
  try {
    /* check if `id` or `employee_id` is provided */
    if (!req.params.id || !req.params.employee_id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get higher up `user` */
    const [user, employee] = await Promise.all([
      r.table('users').get(req.params.id).run(conn),
      r.table('users').get(req.params.employee_id).run(conn)
    ]);

    /* check if higher up `user` does not exists */
    if (!user) {
      return res.send(400, { message: id_does_not_exists });
    }

    /* check if `employee` does not exists */
    if (!employee) {
      return res.send(400, { message: `employee ${id_does_not_exists}` });
    }

    /* extract needed properties */
    const { id: emp_id, role: emp_role } = employee;
    const { role: user_role } = user;

    /* get the list of `roles` that can be updated by users `role`  */
    employees_that_can_be_updated = rolesToBeModifiedByRole(user_role);
    /* ceo = ['ceo', 'assistant', 'president', 'hr', 'pm', 'senior developer', 'junior developer'] */
    /* president = ['president', 'hr', 'pm', 'senior developer', 'junior developer']  */
    /* hr = [hr', 'pm', 'senior developer', 'junior developer'] */
    /* pm = ['pm', 'senior developer', 'junior developer'] */
    /* senior developer = ['senior developer', 'junior developer'] */


    /* check if `employee.role` does not belong to `roles` that can be remove by `user` */
    if (!employees_that_can_be_updated.includes(emp_role) || user_role === 'assistant') {
      return res.send(400, { message: invalid_update })
    }


    /* check if user's `id` is equal to employees `id` */
    const is_id_equals = req.params.id === emp_id;

    /* check if the `senior developer` updating is not the owner of this `id` */
    if (user_role === 'senior developer' && emp_role === 'senior developer' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* check if the `pm` updating is not the owner of this `id` */
    if (user_role === 'pm' && emp_role === 'pm' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* check if the `hr` updating is not the owner of this `id` */
    if (user_role === 'hr' && emp_role === 'hr' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* updating user */
    const { first_error } = await r.table('users').get(req.params.employee_id).update(req.body).run(conn);

    return res.send(first_error ? 400 : 200, first_error ? { message: "Unable to update. Please try again later." } : req.body);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}



server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser());
server.post('/api/login', loginRoute);
server.get('/api/users', getUsersRoute);
server.get('/api/users/:id', getUsersByIdRoute);
server.post('/api/users', createUserRoute);
server.put('/api/users/:id', updateUserRoute);
server.put('/api/users/:id/employees/:employee_id', updateUserByHigherUpRoute);
server.del('/api/users/:id/employees/:employee_id', removeUserByHigherUpRoute);
server.get('*', (req, res) => res.send(404));
server.post('*', (req, res) => res.send(404));
server.put('*', (req, res) => res.send(404));
server.del('*', (req, res) => res.send(404));


const indexCreate = async (con, index_name, table_name = 'users') => {
  return r.table(table_name).indexCreate(index_name).run(con);
};

server.listen(port, async () => {
  let conn;
  try {
    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    const indexes_made = await r.table('users').indexList().run(conn);
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