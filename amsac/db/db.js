import knexLib from 'knex';
import config from '../../knexfile.js';

const knex = knexLib(config);

export default knex;