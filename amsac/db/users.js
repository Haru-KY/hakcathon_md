import knex from "knex";
import config from "../../knexfile.js";

const users_db = knex(config.users);

export default users_db;