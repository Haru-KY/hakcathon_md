import mysql from 'mysql2';
import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';

import knex from "../db/db.js";
router.get('/', function (req, res, next) {
  res.render('register', {
    title: 'Sign up',
    error: null
  });
});

router.get('/login', function (req, res, next) {

    res.render('login',{
        title: 'login',
        error: null
    });
});

router.post('/', function( req, res, next ) {

    console.log("POST /register reached");
    console.log(req.body);

    const username = req.body.user;
    const password = req.body.password;
    const repassword = req.body.repassword;

    knex("users")
        .where({name: username})
        .select("*")
        .then(async function (result) {

            if (result.length !== 0){

                res.render("register", {
                    title: "Sign up",
                    error: "このユーザ名は既に使われています"
                })

            }
            else if (password === repassword) {

                const hashedPassword = await bcrypt.hash(password, 10);
                console.log(hashedPassword);
                knex("users")
                .insert({name: username, password: hashedPassword})
                .then( function () {

                    res.redirect("/login");

                })
                .catch( function (err) {

                    console.error(err);
                    res.render("register", {

                        title: "Sign up",
                        error: [err.sqlMessage]
                        
                    });

                });

            }else{

                res.render("register", {

                    title: "Sign up",
                    error: "パスワードが一致しません"

                });

            }

        })
        .catch(function (err) {
            console.error(err);
            res.render("register", {

                title: "Sign up",
                error: [err.sqlMessage]
                    
            });
        });

});

export default router;