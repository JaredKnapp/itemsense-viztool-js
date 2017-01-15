const ItemSense = require("itemsense-node"),
    path = require("path"),
    makeUrl = u => `http://${u.replace("http://","").replace(/\/$/,"")}/itemsense`;


const md = {
    connectToItemsense(url,user,password){
        return new ItemSense({
            itemsenseUrl: makeUrl(url),
            username: user || 'admin',
            password: password || 'admindefault'
        });
    },
    getProjectDir(id){
        return path.resolve(__dirname, "..", "public", "projects", id || "");
    }
};

module.exports = md;