import mysql from "mysql2";
import express from 'express';
const router = express.Router();

import knex from "../db/db.js";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('home', { title: 'Amsac' });
});

export default router;
