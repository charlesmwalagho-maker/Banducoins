const { getStore, connectLambda } = require("@netlify/blobs");

function normWallet(ph) {
  let s = String(ph || "").replace("+", "").replace(/\s/g, "").trim();
  if (s.startsWith("0")) s = "254" + s.slice(1);
  return s;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  try {
    connectLambda(event);
    const usersStore = getStore("users");
    const postsStore = getStore("posts");
    const mediaStore = getStore("media");
    const chatsStore = getStore("chats");
    const walletsStore = getStore("wallets");
    const notifsStore = getStore("notifs");
    const livesStore = getStore("lives");
    const payoutsStore = getStore("payouts");

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const action = q.action || "";

      if (action === "media" && q.id) {
        const item = await mediaStore.get(q.id, { type: "json" });
        if (!item || !item.data) return { statusCode: 404, body: "Not found" };
        return {
          statusCode: 200,
          headers: {
            "Content-Type": item.mime || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*"
          },
          body: item.data,
          isBase64Encoded: true
        };
      }

      if (action === "users") {
        const list = (await usersStore.get("all_users", { type: "json" })) || [];
        const safe = list.map((u) => {
          const copy = { ...u };
          delete copy.passHash;
          return copy;
        });
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(safe) };
      }

      if (action === "posts") {
        const posts = (await postsStore.get("feed", { type: "json" })) || [];
        const now = Date.now();
        // Strip viewer identities older than 24 hours
        const clean = posts.map((p) => {
          if (p.createdAt && (now - p.createdAt) >= 86400000 && Array.isArray(p.viewedBy) && p.viewedBy.length) {
            return { ...p, viewedBy: [] };
          }
          return p;
        });
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(clean) };
      }

      if (action === "chat" && q.key) {
        const msgs = (await chatsStore.get(q.key, { type: "json" })) || [];
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(msgs) };
      }

      if (action === "notifs" && q.phone) {
        const items = (await notifsStore.get(normWallet(q.phone), { type: "json" })) || [];
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(items) };
      }

      if (action === "liveList") {
        const now = Date.now();
        let lives = (await livesStore.get("active", { type: "json" })) || [];
        lives = lives.filter((l) => (now - (l.updatedAt || l.startedAt || 0)) < 7200000);
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(lives) };
      }

      if (action === "payouts") {
        const list = (await payoutsStore.get("queue", { type: "json" })) || [];
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(list) };
      }

      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Unknown action" }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const action = body.action || "";

      if (action === "signup") {
        const phone = String(body.phone || "").trim();
        const name = String(body.name || "").trim();
        const usernameLower = name.toLowerCase();
        const refCode = String(body.refCode || "").trim().toUpperCase();
        if (!phone || !name || !body.passHash) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing fields" }) };
        }

        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        if (allUsers.find((u) => u.phone === phone)) {
          return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "This +254 number already has an account. LOGIN instead." }) };
        }
        if (allUsers.find((u) => (u.usernameLower || "") === usernameLower)) {
          return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "Username " + name + " is already taken!" }) };
        }

        const myRefCode = "BANDU" + phone.slice(-4);
        const newUser = {
          phone, name, usernameLower, passHash: body.passHash,
          bio: "", avatar: "", cover: "", location: "Eldoret, Kenya",
          website: "banducoins.com", type: "Artist",
          followers: [], following: [], watchedVideos: [],
          refCode: myRefCode, createdAt: Date.now()
        };

        let startCoins = 100;
        let referrerUser = null;

        if (refCode) {
          referrerUser = allUsers.find((u) => (u.refCode || ("BANDU" + u.phone.slice(-4))).toUpperCase() === refCode && u.phone !== phone);
          if (referrerUser) {
            startCoins = 200;
            const refKey = normWallet(referrerUser.phone);
            const refWallet = (await walletsStore.get(refKey, { type: "json" })) || { coins: 100, subcoins: 0, earningCoins: 0 };
            refWallet.coins = (refWallet.coins || 0) + 100;
            await walletsStore.setJSON(refKey, refWallet);

            const refNotifs = (await notifsStore.get(refKey, { type: "json" })) || [];
            refNotifs.unshift({
              from: phone,
              text: "🎁 Referral Bonus: +100 coins! " + name + " joined using your code.",
              type: "ref", time: new Date().toLocaleString(), read: false
            });
            await notifsStore.setJSON(refKey, refNotifs.slice(0, 50));
          }
        }

        allUsers.push(newUser);
        await usersStore.setJSON("all_users", allUsers);

        const newKey = normWallet(phone);
        await walletsStore.setJSON(newKey, { coins: startCoins, subcoins: 0, earningCoins: 0 });

        const safeUser = { ...newUser };
        delete safeUser.passHash;
        return {
          statusCode: 200, headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, user: safeUser, coins: startCoins, referralAwardedTo: referrerUser ? referrerUser.name : null })
        };
      }

      if (action === "login") {
        const phone = String(body.phone || "").trim();
        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        const found = allUsers.find((u) => u.phone === phone);
        if (!found || found.passHash !== body.passHash) {
          return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Wrong +254 phone or password" }) };
        }
        const safeUser = { ...found };
        delete safeUser.passHash;
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, user: safeUser }) };
      }

      if (action === "updateProfile") {
        const phone = String(body.phone || "").trim();
        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        let idx = allUsers.findIndex((u) => u.phone === phone);
        if (idx < 0) {
          allUsers.push({ phone, followers: [], following: [], watchedVideos: [], refCode: "BANDU" + phone.slice(-4), createdAt: Date.now() });
          idx = allUsers.length - 1;
        }
        if (body.name) {
          const ul = body.name.toLowerCase();
          if (allUsers.find((u, i) => i !== idx && (u.usernameLower || "") === ul)) {
            return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "Username already taken!" }) };
          }
          allUsers[idx].name = body.name;
          allUsers[idx].usernameLower = ul;
        }
        ["bio", "avatar", "cover", "location", "website", "type"].forEach((k) => {
          if (body[k] !== undefined) allUsers[idx][k] = body[k];
        });
        await usersStore.setJSON("all_users", allUsers);
        const safeUser = { ...allUsers[idx] };
        delete safeUser.passHash;
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, user: safeUser }) };
      }

      if (action === "resetPass") {
        const phone = String(body.phone || "").trim();
        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        const u = allUsers.find((x) => x.phone === phone);
        if (!u) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Account not found" }) };
        u.passHash = body.passHash;
        await usersStore.setJSON("all_users", allUsers);
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "post") {
        const post = body.post || {};
        if (post.url && String(post.url).startsWith("data:")) {
          const match = String(post.url).match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mediaId = "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
            await mediaStore.setJSON(mediaId, { mime: match[1], data: match[2] });
            post.url = "/.netlify/functions/social?action=media&id=" + mediaId;
            if (post.musicIsVideo && !post.musicUrl) post.musicUrl = post.url;
          }
        }
        const posts = (await postsStore.get("feed", { type: "json" })) || [];
        posts.unshift(post);
        await postsStore.setJSON("feed", posts.slice(0, 150));
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, post }) };
      }

      if (action === "postAction") {
        const posts = (await postsStore.get("feed", { type: "json" })) || [];
        if (body.op === "delete") {
          const kept = posts.filter((x) => !(x.createdAt === body.createdAt && x.phone === body.phone));
          await postsStore.setJSON("feed", kept);
          return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
        }
        const p = posts.find((x) => x.createdAt === body.createdAt && x.phone === body.phone);
        if (p) {
          if (body.op === "like") {
            p.likes = body.likes;
            p.likedBy = body.likedBy;
            if (Array.isArray(body.likedByUsers)) p.likedByUsers = body.likedByUsers;
          } else if (body.op === "comment") {
            p.comments = body.comments;
          } else if (body.op === "share") {
            p.shares = body.shares;
          } else if (body.op === "view") {
            p.views = (p.views || 0) + 1;
            const now = Date.now();
            if (p.createdAt && (now - p.createdAt) < 86400000 && body.viewerPhone) {
              if (!Array.isArray(p.viewedBy)) p.viewedBy = [];
              if (!p.viewedBy.find((v) => v.phone === body.viewerPhone)) {
                p.viewedBy.unshift({ phone: body.viewerPhone, name: body.viewerName || body.viewerPhone, avatar: body.viewerAvatar || "", at: now });
                p.viewedBy = p.viewedBy.slice(0, 200);
              }
            }
          }
          await postsStore.setJSON("feed", posts);
        }
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "follow") {
        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        const me = allUsers.find((u) => u.phone === body.followerPhone);
        const target = allUsers.find((u) => u.phone === body.targetPhone);
        if (me) {
          if (!Array.isArray(me.following)) me.following = [];
          if (body.follow && !me.following.includes(body.targetPhone)) me.following.push(body.targetPhone);
          if (!body.follow) me.following = me.following.filter((x) => x !== body.targetPhone);
        }
        if (target) {
          if (!Array.isArray(target.followers)) target.followers = [];
          if (body.follow && !target.followers.includes(body.followerPhone)) target.followers.push(body.followerPhone);
          if (!body.follow) target.followers = target.followers.filter((x) => x !== body.followerPhone);
        }
        await usersStore.setJSON("all_users", allUsers);
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "watched") {
        const allUsers = (await usersStore.get("all_users", { type: "json" })) || [];
        const me = allUsers.find((u) => u.phone === body.phone);
        if (me) {
          if (!Array.isArray(me.watchedVideos)) me.watchedVideos = [];
          if (!me.watchedVideos.includes(body.videoKey)) {
            me.watchedVideos.push(body.videoKey);
            if (me.watchedVideos.length > 500) me.watchedVideos = me.watchedVideos.slice(-500);
            await usersStore.setJSON("all_users", allUsers);
          }
        }
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "chat") {
        const msgs = (await chatsStore.get(body.key, { type: "json" })) || [];
        msgs.push(body.msg);
        await chatsStore.setJSON(body.key, msgs.slice(-200));
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "liveStart") {
        let lives = (await livesStore.get("active", { type: "json" })) || [];
        lives = lives.filter((l) => l.phone !== body.phone);
        lives.unshift({
          phone: body.phone,
          name: body.name || body.phone,
          avatar: body.avatar || "",
          title: body.title || "LIVE now!",
          startedAt: Date.now(),
          updatedAt: Date.now(),
          likes: 0,
          comments: [],
          snapshot: body.snapshot || ""
        });
        await livesStore.setJSON("active", lives.slice(0, 50));
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "livePing") {
        const lives = (await livesStore.get("active", { type: "json" })) || [];
        const l = lives.find((x) => x.phone === body.phone);
        if (l) {
          l.updatedAt = Date.now();
          if (body.snapshot) l.snapshot = body.snapshot;
          await livesStore.setJSON("active", lives);
        }
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ live: l || null }) };
      }

      if (action === "liveEnd") {
        let lives = (await livesStore.get("active", { type: "json" })) || [];
        lives = lives.filter((l) => l.phone !== body.phone);
        await livesStore.setJSON("active", lives);
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }

      if (action === "liveInteract") {
        const lives = (await livesStore.get("active", { type: "json" })) || [];
        const l = lives.find((x) => x.phone === body.hostPhone);
        if (l) {
          if (body.op === "like") l.likes = (l.likes || 0) + 1;
          else if (body.op === "comment" && body.comment) {
            if (!Array.isArray(l.comments)) l.comments = [];
            l.comments.push(body.comment);
            l.comments = l.comments.slice(-60);
          } else if (body.op === "gift" && body.amount > 0) {
            const amt = Number(body.amount);
            const streamerShare = Math.round(amt * 0.75);
            const hostKey = normWallet(body.hostPhone);
            const hostWallet = (await walletsStore.get(hostKey, { type: "json" })) || { coins: 100, subcoins: 0, earningCoins: 0 };
            hostWallet.earningCoins = (hostWallet.earningCoins || 0) + streamerShare;
            await walletsStore.setJSON(hostKey, hostWallet);
            if (!Array.isArray(l.comments)) l.comments = [];
            l.comments.push({ user: body.senderName || "Fan", text: "🎁 sent " + body.label + " (" + amt + " coins)!" });
            l.comments = l.comments.slice(-60);
          }
          l.updatedAt = Date.now();
          await livesStore.setJSON("active", lives);
        }
        return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, live: l || null }) };
      }

      if (action === "withdrawRequest") {
        const phone = String(body.phone || "").trim();
        const coinsAmt = Number(body.coins || 0);
        const ksh = Number(body.ksh || 0);
        if (!phone || coinsAmt < 10000) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Minimum 10,000 coins" }) };
        const queue = (await payoutsStore.get("queue", { type: "json" })) || [];
        queue.unshift({ id: "pay_" + Date.now(), phone, coins: coinsAmt, ksh, status: "pending", at: new Date().toLocaleString() });
        await payoutsStore.setJSON("queue", queue.slice(0, 200));
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
      }
    }

    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
