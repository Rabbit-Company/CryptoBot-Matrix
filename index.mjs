import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
} from "matrix-bot-sdk";
import fetch from "node-fetch";
import * as dotenv from 'dotenv';
dotenv.config();

let cryptos = [];
const storage = new SimpleFsStorageProvider("storage.json");

const client = new MatrixClient(process.env.server, process.env.token, storage);
AutojoinRoomsMixin.setupOnClient(client);

var round = 1;
var timer = 10000;
var prefix = "$";
var idsArray = [];
var names = null;
var prices = new Map();

function getNames(){
	fetch("https://api.coingecko.com/api/v3/coins/list?include_platform=false").then(response => {
		if (response.ok) return response.json();
	}).then(json => {
		names = [];
		cryptos = [];
		idsArray = [];
		for(let i = 0; i < json.length; i++){
			cryptos.push(json[i].symbol.toUpperCase());
			if(typeof(names[json[i].symbol.toUpperCase()]) == 'undefined') names[json[i].symbol.toUpperCase()] = [];
			names[json[i].symbol.toUpperCase()].push(json[i].id);
		}

		console.log("[" + new Date().toLocaleString() + "] Supported Cryptos: " + cryptos.length);

		cryptos.forEach(crypto => {
			if(typeof(names[crypto]) != 'undefined' && typeof(names[crypto]) != 'string'){
				names[crypto] = names[crypto].reduce(function(a, b) {
					return a.length <= b.length ? a : b;
				});

				if(typeof(idsArray[idsArray.length - 1]) == 'undefined'){
					idsArray.push(names[crypto] + ",");
				}else if(idsArray[idsArray.length - 1].length < 1900){
					idsArray[idsArray.length - 1] += names[crypto] + ",";
				}else{
					idsArray[idsArray.length - 1] = idsArray[idsArray.length - 1].slice(0, -1);
					idsArray.push(names[crypto] + ",");
				}
			}
		});

		console.log("[" + new Date().toLocaleString() + "] " + idsArray.length + " rounds created.");

		setInterval(function() {
			fetchPrices();
		}, timer);
	}).catch();
}

function fetchPrices(){
	fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + idsArray[round] + "&vs_currencies=usd", {cache: "no-store"}).then(response => {
		if (response.ok) return response.json();
	}).then(json => {
		cryptos.forEach(crypto => {
			if(typeof(names[crypto]) != 'undefined' && typeof(json[names[crypto]]) != 'undefined' && typeof(json[names[crypto]].usd) != 'undefined'){
				prices.set(crypto, json[names[crypto]].usd);
			}
		});

		if(round == idsArray.length - 1){
			round = -1;
			console.log("[" + new Date().toLocaleString() + "] All rounds completed. Restarting loop.");
		}
		round++;
	}).catch();
}

getNames();

client.on("room.message", handleCommand);
client.start().then(() => console.log("[" + new Date().toLocaleString() + "] Bot started!"));

async function handleCommand(roomId, event) {
	if (event['content']?.['msgtype'] !== 'm.text') return;
	if (event["sender"] === await client.getUserId()) return;

	const body = event["content"]["body"];
	if (!body?.startsWith(prefix)) return;

	let crypto = body.toUpperCase().replace(prefix, "");
	if(!cryptos.includes(crypto)) return;

	let p = parseFloat(prices.get(crypto));
	if(p >= 1) p = p.toFixed(2);
	else if(p >= 0.01) p = p.toFixed(4);
	else if(p >= 0.0001) p = p.toFixed(6);
	else if(p >= 0.000001) p = p.toFixed(8);
	else p = p.toFixed(12);

	await client.replyNotice(roomId, event, "Price of " + crypto + " is $" + p);
}