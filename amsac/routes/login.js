import mysql from 'mysql2';
import express from 'express';
const router = express.Router();
import cookieParser from 'cookie-parser';

import knex from "../db/users.js";

router.get('/', function(req, res, next){

    res.render('login', {
            title: 'login',
            error: null
    });
});

router.get("/register", function (req, res, next){

    res.render('register',{
        title: 'Sign up',
        error: null
    });
});

router.post("/", function (req, res, next){

    console.log("req.body:", req.body);

    const username = req.body.user;
    const password = req.body.password;

    knex("users")
        .where( {

            name: username,
            password: password

        } )
        .select("*")
        .then((results) => {

            if ( results.length === 0 ) {

                res.render("login", {

                    title: "login",
                    error: ["ユーザが見つかりません"]

                });

            } else {

                req.session.userid = results[0].id;
                res.cookie("userid", results[0].id, {

                    httpOnly: true,
                    maxAge: 1000 * 60 * 60

                });
                res.redirect("/add");

            }

        })
        .catch( function (err) {

            console.error(err);
            res.render("login", {

                title: "login",
                error: [err.sqlMessage],
                isAuth: false
                
            });

        });

});

export default router;