
import mysql from 'mysql2';
import express from 'express';
const router = express.Router();

import users from "../db/users.js";

router.get( '/', function( req, res, next) {

    if( !req.session.userid )
    {
        return res.redirect("/login");
    }

    res.render( 'add', {title: "main page", userId: req.session.userid });

});

export default router;
