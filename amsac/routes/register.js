import mysql from 'mysql2';
import express from 'express';
const router = express.Router();

import users from "../db/users.js";

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

router.post('/register', function( req, res, next ) {

    const username = req.body.user;
    const password = req.body.password;
    const repassword = req.body.repassword;

    users("users")
        .where({name: username})
        .select("*")
        .then(function (result) {

            if (result.length !== 0){

                res.render("register", {
                    title: "Sign up",
                    error: "このユーザ名は既に使われています"
                })

            }
            else if (password === repassword) {

                users("users")
                .insert({name: username, password: password})
                .then( function () {

                    res.redirect("/");

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