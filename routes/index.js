'use strict';
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'Express' });
});

//Colton Alert
router.post('/coltonalert', function (req, res, next) {
    console.log(req.body);
    var orderObject = {
        "orderType": "MARKET",
        "session": "NORMAL",
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "orderLegCollection": [
            {
                "instruction": req.body.side.toUpperCase(),
                "quantity": req.body.quantity,
                "instrument": {
                    "symbol": req.body.symbol.toUpperCase(),
                    "assetType": "EQUITY"
                }
            }
        ]
    }
    //Place Order
    var placeorder_req = {
        url: 'https://api.tdameritrade.com/v1/accounts/' + bot.lastAccountID + '/orders',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + bot.accesstoken,
            'content-type': 'application/json',
            'connection': 'Keep-Alive'
        },
        body: orderObject,
        json: true
    };
    request(placeorder_req, function (error, response, body) {
        console.log(body);
    });
    res.status(200).end() // Responding is important
});

module.exports = router;
