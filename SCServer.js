// Cool stuff goes here

var devToken = 'SBj6klq15kt13tl2lvg13neyuvssr866';
var prodToken = 'l3tob6zd7x4el7svcfk33v7jxahq61z7';
var Timeline = require('pebble-api').Timeline;
var timeline = new Timeline({
    apiKey: devToken
});
var MongoClient = require('mongodb').MongoClient;
var TestUrl = 'mongodb://localhost:27017/BaseballSCTest';
var ProdUrl = 'mongodb://localhost:27017/BaseballSC';
var MongoUrl = TestUrl;
var schedule = require('node-schedule');
var request = require('request');
var selectedDate = new Date();
selectedDate.setTime(selectedDate.getTime() - (5 * 60 * 60 * 1000));

console.log('This is the server (tm)');

function getURL() {
    var date = [];
    date.push(selectedDate.getFullYear());
    date.push(selectedDate.getMonth());
    date.push(selectedDate.getDate());

    // Month is given from 0-11
    var month = (date[1] + 1).toString();
    if (month.length === 1) {
            date[1] = '0' + month;
    }

    var day = (date[2]).toString();
    if (day.length === 1) {
            date[2] = '0' + day;
    }

    var baseUrl = 'http://m.mlb.com/gdcross/components/game/mlb/';
    var urlyear = 'year_' + date[0] + '/';
    var urlmonth = 'month_' + date[1] + '/';
    var urlday = 'day_' + date[2] + '/';
    var scoreText = 'master_scoreboard.json';

    var ballurl = baseUrl + urlyear + urlmonth + urlday + scoreText;
    return ballurl;
}

function getDateObj (game) {
    var dateString = selectedDate.toJSON().split('T')[0];

    var givenTime = game.time_aw_lg;
    var timeSpl = game.time_aw_lg.split(':');
    var offset = game.time_zone_aw_lg;

    if (offset.length > 1) {
        offset = offset[1];
    }

    // I'm fairly certain a game won't be scheduled past 12:00AM
    if (game.ampm === 'PM' && timeSpl[0] !== '12') {
        givenTime = (parseInt(timeSpl[0]) + 12).toString() + ':' + timeSpl[1];
    }
	
    var newDate = new Date(dateString + 'T' + givenTime + '-0' + offset + '00');
	
    return newDate;
}

request(getURL(), function (error, response, body) {
    if (!error) {
	sendPinController(JSON.parse(body));
    }
});

function getStatus (game) {
    if (game.linescore) {
	if (game.status.status === 'Game Over' || game.status.status === 'Final') {
	    return 'Over';
	}
	else if (game.status.status.toLowerCase().indexOf('delay') !== -1 || game.status.status.toLowerCase().indexOf('postpone') !== -1 || game.status.status.toLowerCase().indexOf('cancel') !== -1) {
	    return 'Halted';
	}
	else {
	    return 'In Progress';
	}
    }
    else {
	return 'Not Started';
    }
}

function sendPregamePin (game) {
    var gameDate = getDateObj(game);
	
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'-'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': game.away_name_abbrev + ' @ ' + game.home_name_abbrev,
            'nameAway': game.away_name_abbrev,
	    'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
            'sportsGameState': 'pre-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL'
	},
	reminders: [ 
	    {
		'time': gameDate,
		'layout': {
		    'type': genericReminder,
		    'tinyIcon': 'system://images/TIMELINE_BASEBALL',
		    'title': game.away_name_abbrev + ' @ ' + game.home_name_abbrev
		}
	    }
	]
    });
    
    timeline.sendSharedPin([game.away_name_abbrev, game.home_name_abbrev], pin, function (err) {
        if (err) {
            console.log(err);
        }
	else {
	    console.log('Pin sent!');
        }
     });
}

function sendPinController (body) {

    var games = body.data.games.game;
    for (var i in games) {
	var game = games[i];
	var gameStatus = getStatus(game);
	if (gameStatus === 'Not Started') {
	    sendPregamePin (game);
	}
    }
}

function insertGames (db, gameList, date) {
    var date = [];
    date.push(selectedDate.getFullYear());
    date.push(selectedDate.getMonth());
    date.push(selectedDate.getDate());

    // Month is given from 0-11
    var month = (date[1] + 1).toString();
    if (month.length === 1) {
        date[1] = '0' + month;
    }

    var day = date[2].toString();
    if (day.length === 1) {
            date[2] = '0' + day;
    }

    var nameString = date.join('-');
    console.log(nameString);
    
    var collection = db.collection();
}
