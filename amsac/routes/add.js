
import mysql from 'mysql2';
import express from 'express';
const router = express.Router();

import users from "../db/users.js";

router.get( '/', function( req, res, next) {

    res.render( 'add', {title: "main page", error: null});

});

export default router;
