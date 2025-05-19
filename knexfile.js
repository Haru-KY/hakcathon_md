// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */

const config = {

  users: {

    client: 'mysql2',
    connection: {
      database: "amsac",
      user: "root",
      password: "mdmdMDMD",

    },
    pool: {

      min: 1,
      max: 2,

    },

  },

};

export default config;
