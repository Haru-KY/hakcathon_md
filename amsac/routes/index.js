import mysql from "mysql2";
import express from 'express';
const router = express.Router();

import users from "../db/users.js";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

export default router;
