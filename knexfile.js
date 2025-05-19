// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */

const config = {

  users: {

    client: 'mysql2',
    connection: {
      database: "users",
      user: "root",
      password: "harutoon424722!@!",

    },
    pool: {

      min: 1,
      max: 2,

    },

  },

};

export default config;
