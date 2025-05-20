import express from 'express';
const router = express.Router();

import knex from "../db/db.js";

router.get( '/', async function ( req, res, next) {

    try {
        const userId = req.session.userid;

        if(!userId)
        {

            return res.redirect('/login');

        }


        const emails = await knex( "email" )
            .select("id", "subject", "body")
            .where("user_id", userId)
            .orderBy("created_at", "desc")
            .limit(10);

        res.render("add", {
            title: "Main page",
            emails: emails
        });
    } catch (err) {

        console.error(err);
        res.status(500).send("サーバーエラー");

    }
});

export default router;
