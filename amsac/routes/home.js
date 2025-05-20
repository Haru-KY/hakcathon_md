import mysql from 'mysql2';
import express from 'express';
const router = express.Router();

import knex from "../db/db.js";

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'mdmdMDMD',
  database: 'amsac'
});

router.get( '/', function( req, res, next) {

    res.render( 'home', {title: "Home", error: null});

});

export default router;