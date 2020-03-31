const restify = require('restify');
const r = require('rethinkdb');
const { all, each } = require('bluebird');


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
const invalid_update = `you don't have permission to update this employee.`;
const invalid_remove = `you don't have permission to deactivate this employee.`
const deactivated_acc = 'Your account has been deactivated.';
/* Responses End */


const getUsersRoute = async (req, res) => {
  let conn, users;
  try {

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* check if query `role` has a value and use that value for the index */
    if (req.query.role) {
      const roles = await r.table('organization')
        .map(r.row('job_role')).coerceTo('array')
        .run(conn);
      /* check if query `role` is in not roles */
      if (!roles.includes(req.query.role.toLowerCase())) {
        return res.send(400, { message: invalid_role });
      }
      /* if role is valid get data from `users` table based on the query `role` */
      users = await r.table('users')
        .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
        .without({ right: 'id' })
        .zip()
        .filter(r.row('job_role').eq(req.query.role.toLowerCase()))
        .coerceTo('array')
        .run(conn);

    } else {
      users = await r.table('users')
        .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
        .without({ right: 'role_id', left: 'role_id' }) /* don't include the field `id` on the table `organization` when joining */
        .zip().coerceTo('array')
        .run(conn);
    }
    res.send(200, { users });
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const loginRoute = async (req, res) => {
  let conn, subordinates = [], user;
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

    /* extract needed properties */
    const { password, employment_status, role_id } = user;

    /* check if user's `employment_status` is `deactivated` */
    if (employment_status === 'deactivated') {
      return res.send(400, { message: deactivated_acc });
    }

    /* check if password is correct */
    if (password !== req.body.password) {
      return res.send(400, { message: 'wrong password. please try again.' });
    }

    /* get the `role_ids` that are under this `role_id` */
    const role_ids = await r.table('hierarchy')
      .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
      .zip()
      .filter({ reports_to_role_id: role_id })
      .pluck('role_id')
      .map(r.row('role_id'))
      .coerceTo('array')
      .run(conn);

    /* extract `length` property from array */
    const { length } = role_ids;

    /* check if users has a number of subordinates */
    if (length) {
      subordinates = await r.table('users')
        .getAll(...role_ids, { index: 'role_id' })
        .coerceTo('array')
        .run(conn);
    }

    res.send(200, { user, is_auth: true, subordinates });
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const getUserByIdRoute = async (req, res) => {
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

const getUsersSubordinatesRoute = async (req, res) => {
  let conn, subordinates = [];
  try {

    /* check if id is not provided */
    if (!req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get `user` details from db */
    const user = await r.table('users')
      .get(req.params.id)
      .run(conn);

    /* check if user does not exists */
    if (!user) {
      return res.send(400, { message: 'user does not exists' })
    }

    /* extract needed properties */
    const { role_id, employment_status } = user;

    /* check if user's `employment_status` is `deactivated` */
    if (employment_status === 'deactivated') {
      return res.send(400, { message: deactivated_acc });
    }

    /* get the `role_ids` that are under this `role_id` */
    const role_ids = await r.table('hierarchy')
      .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
      .zip()
      .filter({ reports_to_role_id: role_id })
      .pluck('role_id')
      .map(r.row('role_id'))
      .coerceTo('array')
      .run(conn);
    /* */
    /* extract `length` property from array */
    const { length } = role_ids;
    /* check if users has a number of subordinates */
    if (length) {
      subordinates = await r.table('users')
        .getAll(...role_ids, { index: 'role_id' })
        .coerceTo('array')
        .run(conn);
    }


    res.send(200, { subordinates })
  } catch (error) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const getUsersSubordinateRoute = async (req, res) => {
  let conn;
  try {

    /* check if ids are not provided */
    if (!req.params.id || !req.params.subordinate_id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get higher up `user` and `subordinate` */
    const [user, subordinate] = await all([
      r.table('users').get(req.params.id).run(conn),
      r.table('users').get(req.params.subordinate_id).run(conn),
    ]);

    /* check if higher up `user` does not exists */
    if (!user) {
      return res.send(400, { message: id_does_not_exists });
    }

    /* check if `subordinate` does not exists */
    if (!subordinate) {
      return res.send(400, { message: `subordinate ${id_does_not_exists}` });
    }

    /* extract needed properties */
    const { role_id: sub_role_id } = subordinate;
    const { employment_status, role_id } = user;

    /* check if user's `employment_status` is `deactivated` */
    if (employment_status === 'deactivated') {
      return res.send(400, { message: deactivated_acc });
    }

    /* get the `role_ids` that are under this `role_id` */
    const role_ids = await r.table('hierarchy')
      .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
      .zip()
      .filter({ reports_to_role_id: role_id })
      .pluck('role_id')
      .map(r.row('role_id'))
      .coerceTo('array')
      .run(conn);

    /* check `item` is undefined when `user_role` is `junior developer` */
    if (!role_ids.includes(sub_role_id)) {
      return res.send(400, { message: 'Your not allowed to view this employee.' });
    }

    res.send(200, subordinate);
  } catch (error) {
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

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    const roles = await r.table('organization')
      .map(r.row('job_role')).coerceTo('array')
      .run(conn);

    /* check if role is valid */
    if (!req.body.role || !isString(req.body.role) || !roles.includes(req.body.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

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
        .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
        .without({ right: 'id' })
        .zip()
        .filter(r.row('job_role').eq(req.body.role.toLowerCase()))
        .coerceTo('array')
        .run(conn);

      if (user && user.employment_status == 'active'
        && (user.job_role === 'president' || user.job_role === 'ceo')) {
        return res.send(400, { message: `role for ${user.job_role} is already taken. please try another one.` });
      }
    }

    const [item] = await r.table('organization')
      .getAll(req.body.role.toLowerCase(), { index: 'job_role' })
      .coerceTo('array')
      .run(conn);

    /* extract `role_id` from item */
    const { role_id } = item;

    const { first_error, generated_keys } = await r.table('users')
      .insert({ ...req.body, role: req.body.role.toLowerCase(), employment_status: 'active', role_id })
      .run(conn);

    return res.send(first_error ? 400 : 200,
      first_error ? { message: 'Cant insert data. Please try again later.' }
        : { ...req.body, role: req.body.role.toLowerCase(), id: generated_keys[0], role_id });

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
    if (!req.params.subordinate_id || !req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get higher up `user` and `subordinate` */
    const [user, subordinate] = await all([
      r.table('users').get(req.params.id).run(conn),
      r.table('users').get(req.params.subordinate_id).run(conn),
    ]);

    /* check if `user` does not exists */
    if (!user) {
      return res.send(400, { message: id_does_not_exists });
    }

    /* check if `employee` does not exists */
    if (!subordinate) {
      return res.send(400, { message: `subordinate ${id_does_not_exists}` });
    }

    /* extract needed properties */
    const { employment_status: status, role_id } = user;
    const { employment_status: sub_status, role_id: sub_role_id } = subordinate;

    /* check if `user` employment_status is `deactivated` */
    if (status === 'deactivated') {
      return res.send(400, { message: deactivated_acc });
    }

    /* check if `subordinate` employment_status is `deactivated` */
    if (sub_status === 'deactivated') {
      return res.send(400, { message: `You're subordinate's account has already been deactivated.` });
    }

    /* get the `role_ids` that are under this `role_id` */
    const role_ids = await r.table('hierarchy')
      .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
      .zip()
      .filter({ reports_to_role_id: role_id })
      .pluck('role_id')
      .map(r.row('role_id'))
      .coerceTo('array')
      .run(conn);


    /* check if subordinates `role_id` is not included in users `subordinatesRolesIds` */
    if (!role_ids.includes(sub_role_id)) {
      return res.send(400, { message: invalid_remove });
    }

    /* updating `employee` here */
    const { first_error } = await r.table('users')
      .get(req.params.subordinate_id)
      .update({ employment_status: 'deactivated' })
      .run(conn);

    res.send(first_error ? 400 : 200, first_error ? { message: "Unable to deactivate. Please try again later." } : undefined);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const updateUserRoute = async (req, res) => {
  let conn;
  try {

    /* check if id is not provided */
    if (!req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    const roles = await r.table('organization')
      .map(r.row('job_role'))
      .coerceTo('array')
      .run(conn);

    /* check if `role` is provided and is not valid */
    if (req.body.role && !roles.includes(req.body.role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

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
  let conn, role_ids;
  try {
    /* check if `id` or `subordinate_id` is provided */
    if (!req.params.id || !req.params.subordinate_id) {
      return res.send(400, { message: invalid_id });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get higher up `user` and `subordinate` */
    const [user, subordinate] = await all([
      r.table('users').get(req.params.id).run(conn),
      r.table('users').get(req.params.subordinate_id).run(conn)
    ]);

    /* check if higher up `user` does not exists */
    if (!user) {
      return res.send(400, { message: id_does_not_exists });
    }

    /* check if `subordinate` does not exists */
    if (!subordinate) {
      return res.send(400, { message: `subordinate ${id_does_not_exists}` });
    }

    /* extract needed properties */
    const { role: sub_role, employment_status: sub_status, role_id: sub_role_id } = subordinate;
    const { role: user_role, employment_status: status, role_id } = user;

    /* check if `user.role` is a junior developer */
    if (user_role === 'junior developer' || user_role === 'assistant') {
      return res.send(400, { message: invalid_update })
    }

    /* check if `user` employment_status is `deactivated` */
    if (status === 'deactivated') {
      return res.send(400, { message: deactivated_acc });
    }

    // /* check if `subordinate` employment_status is `deactivated` */
    // if (sub_status === 'deactivated') {
    //   return res.send(400, { message: `You're subordinate's account has already been deactivated.` });
    // }

    /* get the list of `roles_ids` that can be updated by users `role_id`  */
    role_ids = await r.table('hierarchy')
      .eqJoin('role_id', r.table('organization'), { index: 'role_id' })
      .zip()
      .filter({ reports_to_role_id: role_id })
      .pluck('role_id')
      .map(r.row('role_id'))
      .coerceTo('array')
      .run(conn)


    /* check if `employee.role` does not belong to `roles` that can be remove by `user` */
    if (!role_ids.includes(sub_role_id)) {
      return res.send(400, { message: invalid_update })
    }

    /* check if user's `id` is equal to employees `id` */
    const is_id_equals = req.params.id === req.params.subordinate_id;

    /* check if the `senior developer` updating is not the owner of this `id` */
    if (user_role === 'senior developer' && sub_role === 'senior developer' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* check if the `pm` updating is not the owner of this `id` */
    if (user_role === 'pm' && sub_role === 'pm' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* check if the `hr` updating is not the owner of this `id` */
    if (user_role === 'hr' && sub_role === 'hr' && !is_id_equals) {
      return res.send(400, { message: invalid_update });
    }

    /* updating user */
    const { first_error } = await r.table('users').get(req.params.subordinate_id).update(
      !req.body.role ? req.body : { ...req.body, role: req.body.role.toLowerCase() }
    ).run(conn);

    return res.send(first_error ? 400 : 200,
      first_error ? { message: "Unable to update. Please try again later." } : req.body);

  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const getRolesRoute = async (req, res) => {
  let conn;
  try {
    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get roles from table `organization` without field `id` */
    const roles = await r.table('organization')
      .coerceTo('array')
      .run(conn);

    res.send(200, { roles });
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

const createRolesRoute = async (req, res) => {
  let conn;
  try {

    /* check if `role_name` or `reports_to_roles` is not provided */
    if (!req.body.job_role || !req.body.reports_to_roles) {
      return res.send(400, { message: invalid_data });
    }

    /* check if `reports_to_roles` is not an  array */
    if (!Array.isArray(req.body.reports_to_roles)) {
      return res.send(400, { message: invalid_data });
    }

    /* initialize connection here and explicitly specify db name */
    conn = await r.connect({ db: 'test' });

    const roles = await r.table('organization')
      .coerceTo('array')
      .run(conn);

    /* map the `job_role` from the `roles` object array */
    const job_roles = roles.map(({ job_role }) => job_role);

    /* check if `role_name` provided already exists in `job_roles` */
    if (job_roles.includes(req.body.job_role.toLowerCase())) {
      return res.send(400, { message: 'This job role already exists.' });
    }

    /* check if one of the `roles` in `reports_to_roles` is not a valid role */
    if (!req.body.reports_to_roles.every(role => job_roles.includes(role.toLowerCase()))) {
      return res.send(400, { message: invalid_role });
    }

    const { first_error, generated_keys } = await r.table('organization')
      .insert({
        job_role: req.body.job_role.toLowerCase(),
      })
      .run(conn);

    /* check if an `error` occurred when creating new data */
    if (first_error) {
      return res.send(400, { message: 'Something went wrong went creating data. Please try again later.' })
    }

    /* get the equivalent `role_ids` of specified roles. ex. `["president"] = [''], ["ceo","president"] = [1,2] ` */
    const map_roles_id = req.body.reports_to_roles.map(item => roles.find(({ job_role }) => job_role === item.toLowerCase()).role_id)

    /* extract generated id to use as the `foreign key` */
    const [id] = generated_keys;

    /* run all insert in concurrent and convert map them to promises  */
    const promises = map_roles_id.map(reports_to_role_id =>
      r.table('hierarchy')
        .insert({
          reports_to_role_id,
          role_id: id
        })
        .run(conn)
    );

    /* wait for all insertion calls to finish before responding to client */
    await all(promises);

    res.send(200);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}


const updateRolesRoute = async (req, res) => {
  let conn;
  try {

    /* check if id is not provided */
    if (!req.params.id) {
      return res.send(400, { message: invalid_id });
    }

    /* check if `role` is not provided in the body */
    if (!req.body.job_role) {
      return res.send(400, { message: invalid_data });
    }

    /* check if `reports_to_roles` is not an array */
    if (!Array.isArray(req.body.reports_to_roles)) {
      return res.send(400, { message: invalid_data });
    }

    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });

    /* get the `roles` from `org` table */
    const org_data = await r.table('organization')
      .coerceTo('array')
      .run(conn);

    const roles = org_data.map(({ job_role }) => job_role);
    /* check if the provided `role` is not included in the `roles` */
    if (!roles.includes(req.body.job_role.toLowerCase())) {
      return res.send(400, { message: invalid_role });
    }

    /* check if one of the `roles` in `reports_to_roles` is not a valid role */
    if (!req.body.reports_to_roles.every(job_role => roles.includes(job_role.toLowerCase()))) {
      return res.send(400, { message: invalid_role });
    }

    /* get the `role_id` of the given `job_role` */
    const [{ role_id }] = await r.table('organization')
      .getAll(req.body.job_role.toLowerCase(), { index: 'job_role' })
      .pluck('role_id')
      .coerceTo('array')
      .run(conn);


    /* get the equivalent `role_ids` of specified roles. ex. `["president"] = [uuid], ["ceo","president"] = [uuid,uuid] ` */
    const map_roles_id = req.body.reports_to_roles.map(item => org_data.find(({ job_role }) => job_role === item.toLowerCase()).role_id)

    /* run all insert in concurrent and convert map them to promises  */
    const promises = map_roles_id.map(reports_to_role_id =>
      r.table('hierarchy')
        .insert({
          reports_to_role_id,
          role_id
        })
        .run(conn)
    );

    /* wait for all insertion calls to finish before responding to client */
    await all(promises);

    res.send(200);
  } catch (e) {
    res.send(500, { message: internal_error });
  } finally {
    conn && conn.close();
  }
}

server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser());
server.post('/login', loginRoute);
server.get('/users', getUsersRoute);
server.get('/users/:id', getUserByIdRoute);
server.get('/users/:id/subordinates', getUsersSubordinatesRoute);
server.get('/users/:id/subordinates/:subordinate_id', getUsersSubordinateRoute);
server.post('/users', createUserRoute);
server.get('/roles', getRolesRoute);
server.post('/roles', createRolesRoute);
server.put('/roles/:id', updateRolesRoute);
server.put('/users/:id', updateUserRoute);
server.put('/users/:id/subordinates/:subordinate_id', updateUserByHigherUpRoute);
server.del('/users/:id/subordinates/:subordinate_id', removeUserByHigherUpRoute);
server.post('/logout', (req, res) => res.send(200, { is_auth: false }));
server.get('*', (req, res) => res.send(404));
server.post('*', (req, res) => res.send(404));
server.put('*', (req, res) => res.send(404));
server.del('*', (req, res) => res.send(404));

const indexCreate = async (con, index_name, table_name = 'users') => {
  return r.table(table_name).indexCreate(index_name).run(con);
};

const createIndexesIfNotExists = (indexes_to_create, existing_indexes, conn, table_name = 'users') => {
  indexes_to_create.filter(index => !existing_indexes.includes(index))
    .forEach(index_name => indexCreate(conn, index_name, table_name)
      .then(console.log)
      .catch(({ msg }) => console.log(msg))
    );
}

server.listen(port, async () => {
  let conn;
  try {
    /* initialize connection here and explicitly specify database name */
    conn = await r.connect({ db: 'test' });


    const [users_index_list, org_index_list, hierarchy_index_list] = await all([
      r.table('users').indexList().run(conn),
      r.table('organization').indexList().run(conn),
      r.table('hierarchy').indexList().run(conn)
    ]);

    /* create indexes if they don't exist already */
    createIndexesIfNotExists(['role', 'user_name', 'role_id'], users_index_list, conn);
    createIndexesIfNotExists(['job_role'], org_index_list, conn, 'organization');
    createIndexesIfNotExists(['role_id'], hierarchy_index_list, conn, 'hierarchy');

  } catch (e) {
    console.log(e);
  } finally {
    conn && conn.close();
    console.log(`Server listening at port : ${port}`);
  }
});