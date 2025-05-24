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

        // ページネーションの設定
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;

        let emailsQuery = knex("email")
            .select("id","message_id", "subject", "is_favorite", "body", "summary", "created_at")
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


        const countQuery =  knex("email").where("user_id", userId);
        const totalResult = await countQuery.count("id as count").first();
        const totalCount = totalResult?.count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        // メール取得
// データを取得するクエリ（詳細を含む）

        const emailsRaw = await emailsQuery
            .orderBy("created_at", "desc")
            .limit(limit + 1)
            .offset(offset)
        // ここにタグやフィルター条件も適用
        .orderBy("created_at", "desc")
        .limit(limit + 1)
        .offset(offset);

        const hasNextPage = emailsRaw.length > limit;
        const emails = hasNextPage ? emailsRaw.slice(0, limit) : emailsRaw;



        const email_tags = await knex( "email_tags")
            .select("email_id", "tag_id")
            .where("user_id", userId)

        const tags = await knex( "tags" )
            .select("id", "user_id", "name")
            .where("user_id", userId)

        const ai_tags = await knex( "ai_tags" )
            .select("id", "user_id", "name")
            .where("user_id", userId)

        // 各メールに tags を結びつける処理を追加
        emails.forEach(email => {
            const relatedTagIds = email_tags
                .filter(et => Number(et.email_id) === Number(email.id))
                .map(et => Number(et.tag_id));

            email.tags = tags.filter(tag => relatedTagIds.includes(Number(tag.id)));
        });

        console.log(JSON.stringify(emails, null, 2));

        res.render("add", {
            title: "Main page",
            emails: emails,
            tags: tags,
            ai_tags: ai_tags,
            email_tags: email_tags,
            page: page,
            totalPages: totalPages,
            hasNextPage: hasNextPage,
            pageSize: limit,
            cursor: offset,
            totalThreads: totalCount,
            tag: tagName || "",
            aitag: aiTagName || "",
            favorite: favorite || ""
        });
    } catch (err) {

        console.error(err);
        res.status(500).send("サーバーエラー");

    }
});

export default router;
