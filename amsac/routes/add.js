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

        const tagName = req.query.tag;
        const aiTagName = req.query.aitag;
        const favorite = req.query.favorite;

        let emailsQuery = knex("email")
            .select("id", "subject", "is_favorite", "body")
            .where("user_id", userId)

        if (tagName && tagName.trim() !== ""){

            const tag = await knex("tags")
                .select("id")
                .where({ name: tagName, user_id: userId })
                .first();

            if (tag) {

                const emailIds = await knex("email_tags")
                    .pluck("email_id")
                    .where({ tag_id: tag.id, user_id: userId });

                if(emailIds.length > 0)
                {

                    emailsQuery.whereIn("id", emailIds);

                }else{

                    emailsQuery.whereRaw('0=1');

                }

            } else {
                // タグが存在しない場合は空の結果にする
                emailsQuery.whereRaw('0 = 1');
            }

        }

        if(aiTagName && aiTagName.trim() !== ""){

            const aitag = await knex("ai_tags")
                .select("id")
                .where({ name: aiTagName, user_id: userId })
                .first();

            if(aitag){

                const emailIds = await knex("email_ai_tags")
                    .pluck("email_id")
                    .where({ tag_id: aitag.id, user_id: userId });

                if (emailIds.length > 0) {

                    emailsQuery.whereIn("id", emailIds);

                } else {

                    emailsQuery.whereRaw('0 = 1');

                }

            } else {

                
                emailsQuery.whereRaw('0=1');

            }

        }

        if (req.query.favorite === "true") 
        {
            
            emailsQuery.where("is_favorite", true);
        
        }


        emailsQuery = emailsQuery.orderBy( "created_at", "desc" );

        const emali_tags = await knex( "email_tags")
            .select("email_id", "tag_id")
            .where("user_id", userId)


        const emails = await emailsQuery;

        const tags = await knex( "tags" )
            .select("id", "user_id", "name")
            .where("user_id", userId)

        const ai_tags = await knex( "ai_tags" )
            .select("id", "user_id", "name")
            .where("user_id", userId)

        res.render("add", {
            title: "Main page",
            emails: emails,
            tags: tags,
            ai_tags: ai_tags,
            emial_tags: emali_tags
        });
    } catch (err) {

        console.error(err);
        res.status(500).send("サーバーエラー");

    }
});

export default router;
