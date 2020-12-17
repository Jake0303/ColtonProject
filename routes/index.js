/*
 * Colton TradingView Alert
 */
'use strict';
var express = require('express');
var router = express.Router();
require('dotenv').config();
var request = require('request');
var accesstoken = process.env.accesstoken;
var async = require('async');
/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'Express' });
});

function submitOrder(side, symbol, alert) {
    /*
     * Entry Order
     */
    side = side.toUpperCase();
    var found = false;
    var qty = Math.floor(parseFloat(alert.accountSize) / parseFloat(alert.close));
    //Get main account id
    var account_req = {
        url: 'https://api.tdameritrade.com/v1/accounts?fields=positions',
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + accesstoken
        }
    }
    var orderObject = {
        "orderType": "MARKET",
        "session": "NORMAL",
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "orderLegCollection": [
            {
                "instruction": side,
                "quantity": qty,
                "instrument": {
                    "symbol": symbol,
                    "assetType": "EQUITY"
                }
            }
        ]
    }
    request(account_req, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = JSON.parse(body);
            async.each(body[0]['securitiesAccount']['positions'], function (pos, inner_callback) {
                /*
                 * Check if we have any existing positions, if we do flip sides
                 */
                try {
                    if (pos.instrument.symbol.toUpperCase() == symbol) {
                        console.log(symbol);
                        found = true;
                        var accountId = body[0]['securitiesAccount']['accountId'];
                        /*
                         * 2.) Cancel previous orders
                         */
                        //Get current orders
                        var order_req = {
                            url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Authorization': 'Bearer ' + accesstoken
                            }
                        }
                        request(order_req, function (error, response, body) {
                            /*
                             * Loop and cancel all previous bracket orders
                             */
                            var orders = JSON.parse(body);
                            async.each(orders, function (order, inner_callback2) {
                                console.log(order.childOrderStrategies);
                                async.each(order.childOrderStrategies, function (orderLeg, inner_callback3) {
                                    if (symbol == orderLeg.instrument.symbol.toUpperCase()) {
                                        //Cancel Order
                                        var cancelorder_req = {
                                            url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders/' + order.orderId + '',
                                            method: 'DELETE',
                                            headers: {
                                                'Content-Type': 'application/x-www-form-urlencoded',
                                                'Authorization': 'Bearer ' + accesstoken
                                            }
                                        }
                                        request(cancelorder_req, function (error, response, body) {
                                            inner_callback3();
                                        });
                                    }
                                    else
                                        inner_callback3();
                                }, function (err) {
                                    inner_callback2();
                                });
                            }, function (err) {
                                /*
                                * If we are short and get a buy signal, buy to cover and enter long
                                */
                                if (pos.shortQuantity || pos.settledShortQuantity) {
                                    /*
                                    * 1.) Exit short position
                                    */
                                    side = "BUY_TO_COVER";
                                } else {
                                    /*
                                    * 1.) Exit long position
                                    */
                                    side = "SELL";
                                }
                                /*
                                 * 3.) Exit out of previous position
                                 */
                                orderObject = {
                                    "orderType": "MARKET",
                                    "session": "NORMAL",
                                    "duration": "DAY",
                                    "orderStrategyType": "SINGLE",
                                    "orderLegCollection": [
                                        {
                                            "instruction": side,
                                            "quantity": qty,
                                            "instrument": {
                                                "symbol": symbol,
                                                "assetType": "EQUITY"
                                            }
                                        }
                                    ]
                                }
                                //Place Order
                                var placeorder_req = {
                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Bearer ' + accesstoken,
                                        'content-type': 'application/json',
                                        'connection': 'Keep-Alive'
                                    },
                                    body: orderObject,
                                    json: true
                                };
                                setTimeout(function () {
                                    request(placeorder_req, function (error, response, body) {
                                        console.log(body);
                                        console.log(side);
                                        /*
                                        * 4.) Enter new position
                                        */
                                        if (side == "BUY_TO_COVER")
                                            side = "BUY";
                                        else {
                                            side = "SELL_SHORT";
                                        }
                                        orderObject = {
                                            "orderType": "MARKET",
                                            "session": "NORMAL",
                                            "duration": "DAY",
                                            "orderStrategyType": "SINGLE",
                                            "orderLegCollection": [
                                                {
                                                    "instruction": side,
                                                    "quantity": qty,
                                                    "instrument": {
                                                        "symbol": symbol,
                                                        "assetType": "EQUITY"
                                                    }
                                                }
                                            ]
                                        }
                                        //Place Order
                                        var placeorder_req = {
                                            url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                            method: 'POST',
                                            headers: {
                                                'Authorization': 'Bearer ' + accesstoken,
                                                'content-type': 'application/json',
                                                'connection': 'Keep-Alive'
                                            },
                                            body: orderObject,
                                            json: true
                                        };
                                        request(placeorder_req, function (error, response, body) {
                                            var profitPrice = (alert.close * (1 + (parseFloat(alert.profitTarget) / 100))).toFixed(2).toString();
                                            var stopPrice = (alert.close * (1 - (parseFloat(alert.stopLoss) / 100))).toFixed(2).toString();
                                            /*
                                             * Profit Target and Stop Loss OCO / Bracket Order
                                             */
                                            if (side == "BUY") {
                                                side = "SELL";

                                            }
                                            else {
                                                side = "BUY";
                                                profitPrice = (alert.close * (1 - (parseFloat(alert.profitTarget) / 100))).toFixed(2).toString();
                                                stopPrice = (alert.close * (1 + (parseFloat(alert.stopLoss) / 100))).toFixed(2).toString()
                                            }
                                            if (alert.profitTarget && alert.stopLoss) {
                                                var orderObject = {
                                                    "orderStrategyType": "OCO",
                                                    "childOrderStrategies": [
                                                        {
                                                            "orderType": "LIMIT",
                                                            "session": "NORMAL",
                                                            "duration": "DAY",
                                                            "price": profitPrice,
                                                            "orderStrategyType": "SINGLE",
                                                            "orderLegCollection": [
                                                                {
                                                                    "instruction": side,
                                                                    "quantity": qty,
                                                                    "instrument": {
                                                                        "symbol": symbol,
                                                                        "assetType": "EQUITY"
                                                                    }
                                                                }
                                                            ]
                                                        },
                                                        {
                                                            "orderType": "STOP",
                                                            "session": "NORMAL",
                                                            "duration": "DAY",
                                                            "stopPrice": stopPrice,
                                                            "orderStrategyType": "SINGLE",
                                                            "orderLegCollection": [
                                                                {
                                                                    "instruction": side,
                                                                    "quantity": qty,
                                                                    "instrument": {
                                                                        "symbol": symbol,
                                                                        "assetType": "EQUITY"
                                                                    }
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                                //Place Order
                                                var placeorder_req = {
                                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                                    method: 'POST',
                                                    headers: {
                                                        'Authorization': 'Bearer ' + accesstoken,
                                                        'content-type': 'application/json',
                                                        'connection': 'Keep-Alive'
                                                    },
                                                    body: orderObject,
                                                    json: true
                                                };
                                                request(placeorder_req, function (error, response, body) {
                                                    inner_callback();
                                                });
                                            }
                                            /*
                                            * Just Profit Target
                                            */
                                            else if (alert.profitTarget) {
                                                var orderObject = {
                                                    "orderType": "LIMIT",
                                                    "session": "NORMAL",
                                                    "duration": "DAY",
                                                    "price": profitPrice,
                                                    "orderStrategyType": "SINGLE",
                                                    "orderLegCollection": [
                                                        {
                                                            "instruction": side,
                                                            "quantity": qty,
                                                            "instrument": {
                                                                "symbol": symbol,
                                                                "assetType": "EQUITY"
                                                            }
                                                        }
                                                    ]
                                                }
                                                //Place Order
                                                var placeorder_req = {
                                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                                    method: 'POST',
                                                    headers: {
                                                        'Authorization': 'Bearer ' + accesstoken,
                                                        'content-type': 'application/json',
                                                        'connection': 'Keep-Alive'
                                                    },
                                                    body: orderObject,
                                                    json: true
                                                };
                                                request(placeorder_req, function (error, response, body) {
                                                    inner_callback();
                                                });
                                            }
                                        });


                                    }, 10000);
                                });
                            });
                        });
                    } else inner_callback();
                } catch (err) {
                    console.log(err);
                }
            }, function (err) {
                /*
                 * If we haven't found any positions just do a normal bracket order
                 */
                if (!found) {
                    var accountId = body[0]['securitiesAccount']['accountId'];
                    //Place Order
                    var placeorder_req = {
                        url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + accesstoken,
                            'content-type': 'application/json',
                            'connection': 'Keep-Alive'
                        },
                        body: orderObject,
                        json: true
                    };
                    request(placeorder_req, function (error, response, body) {
                        if (response.statusCode >= 400) {
                            resetAccessToken(function () {
                                submitOrder(side, symbol, alert);
                            });
                        } else {
                            var profitPrice = (alert.close * (1 + (parseFloat(alert.profitTarget) / 100))).toFixed(2).toString();
                            var stopPrice = (alert.close * (1 - (parseFloat(alert.stopLoss) / 100))).toFixed(2).toString();
                            /*
                             * Profit Target and Stop Loss OCO / Bracket Order
                             */
                            if (side == "BUY") {
                                side = "SELL";

                            }
                            else {
                                side = "BUY_TO_COVER";
                                profitPrice = (alert.close * (1 - (parseFloat(alert.profitTarget) / 100))).toFixed(2).toString();
                                stopPrice = (alert.close * (1 + (parseFloat(alert.stopLoss) / 100))).toFixed(2).toString()
                            }
                            if (alert.profitTarget && alert.stopLoss) {
                                var orderObject = {
                                    "orderStrategyType": "OCO",
                                    "childOrderStrategies": [
                                        {
                                            "orderType": "LIMIT",
                                            "session": "NORMAL",
                                            "duration": "DAY",
                                            "price": profitPrice,
                                            "orderStrategyType": "SINGLE",
                                            "orderLegCollection": [
                                                {
                                                    "instruction": side,
                                                    "quantity": qty,
                                                    "instrument": {
                                                        "symbol": symbol,
                                                        "assetType": "EQUITY"
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            "orderType": "STOP",
                                            "session": "NORMAL",
                                            "duration": "DAY",
                                            "stopPrice": stopPrice,
                                            "orderStrategyType": "SINGLE",
                                            "orderLegCollection": [
                                                {
                                                    "instruction": side,
                                                    "quantity": qty,
                                                    "instrument": {
                                                        "symbol": symbol,
                                                        "assetType": "EQUITY"
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                                //Place Order
                                var placeorder_req = {
                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Bearer ' + accesstoken,
                                        'content-type': 'application/json',
                                        'connection': 'Keep-Alive'
                                    },
                                    body: orderObject,
                                    json: true
                                };
                                request(placeorder_req, function (error, response, body) {
                                });
                            }
                            /*
                            * Just Profit Target
                            */
                            else if (alert.profitTarget) {
                                var orderObject = {
                                    "orderType": "LIMIT",
                                    "session": "NORMAL",
                                    "duration": "DAY",
                                    "price": profitPrice,
                                    "orderStrategyType": "SINGLE",
                                    "orderLegCollection": [
                                        {
                                            "instruction": side,
                                            "quantity": qty,
                                            "instrument": {
                                                "symbol": symbol,
                                                "assetType": "EQUITY"
                                            }
                                        }
                                    ]
                                }
                                //Place Order
                                var placeorder_req = {
                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Bearer ' + accesstoken,
                                        'content-type': 'application/json',
                                        'connection': 'Keep-Alive'
                                    },
                                    body: orderObject,
                                    json: true
                                };
                                request(placeorder_req, function (error, response, body) {
                                });
                            }
                        }
                    });
                }
            });

        } else {
            resetAccessToken(function () {
                submitOrder(side, symbol, alert);
            });
        }
    });
}

//Colton Alert
router.post('/coltonalert', function (req, res, next) {
    submitOrder(req.body.side.toUpperCase(), req.body.symbol.toUpperCase(), req.body);
    res.status(200).end() // Responding is important
});


function resetAccessToken(done) {
    try {
        var refreshtoken_req = {
            url: 'https://api.tdameritrade.com/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'grant_type': 'refresh_token',
                'refresh_token': process.env.refreshtoken,
                'access_type': '',
                'client_id': process.env.CLIENT_ID
            }
        };

        request(refreshtoken_req, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Successfully reset access token.');
                // get the TDA response
                var authReply = JSON.parse(body);
                accesstoken = authReply.access_token;
                done();
            } else {
                console.log('Could not reset access token.');
                console.log(body);
                done()
            }
        });

    } catch (err) {
        console.log(err);
    }

}
resetAccessToken(function () { });
module.exports = router;
