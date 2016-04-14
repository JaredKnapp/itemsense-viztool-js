const ItemSense = require("itemsense-node"),
    makeUrl = u => `http://${u.replace("http://","").replace(/\/$/,"")}/itemsense`;


const md = {
    connectToItemsense(url,user,password){
        return new ItemSense({
            itemsenseUrl: makeUrl(url),
            username: user || 'admin',
            password: password || 'admindefault'
        });
    }
};

module.exports = md;