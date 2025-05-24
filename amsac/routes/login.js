import express from 'express';
const router = express.Router();
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';

import knex from "../db/db.js";

router.get('/', function(req, res, next){

    const userId = req.session.userid;
    const isAuth = Boolean(userId);

    res.render('login', {
            title: 'login',
            isAuth: isAuth,
            error: null
    });
});

router.get("/register", function (req, res, next){

    res.render('register',{
        title: 'Sign up',
        error: null
    });
});

router.post("/", async function (req, res, next){

    console.log("req.body:", req.body);

    const { user: username, password } = req.body;

    try{

        const user = await knex("users").where({ name: username }).first();
    
        if (!user){

            return res.render("login", {

                title: "login",
                error: ["ユーザが見つかりません"],
                isAuth: false

            });

        }

        const match = await bcrypt.compare(password, user.password);

        if(!match){
            return res.render("login", {

                title: "login",
                error: ["パスワードが一致しません"],
                isAuth: false
            });
        }

        req.session.userid = user.id;
        return res.redirect("/oauth2callback/auth/google");
    } catch (err) {
        console.error(err);
        res.render("login", {

            title:"login",
            error: ["システムエラーが発生しました"],
            isAuth: false

        });
    }
});

export default router;