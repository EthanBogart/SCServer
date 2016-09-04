// Cool stuff goes here

var devToken = 'SBj6klq15kt13tl2lvg13neyuvssr866';
var prodToken = 'l3tob6zd7x4el7svcfk33v7jxahq61z7';
var Timeline = require('pebble-api').Timeline;
var timeline = new Timeline({
    apiKey: devToken
});
var schedule = require('node-schedule');
var jsonfile = require('jsonfile');
var datafile = 'data.json';
var request = require('request');

console.log('This is the server (tm)');

function main() {
    runTomorrowCycle();
    schedule.scheduleJob('* /1 * * * *', runCycle);
    schedule.scheduleJob('* * /6 * * *', runTomorrowCycle);
}

function runCycle () {
    var selectedDate = new Date();
    selectedDate.setTime(selectedDate.getTime() - (5 * 60 * 60 * 1000));
    
    request(getURL(selectedDate), function (error, response, body) {
	if (!error) {
	    sendPinController(JSON.parse(body), selectedDate);
	}
    });
}

function runTomorrowCycle () {
    var tomorrowDate = new Date();
    tomorrowDate.setTime(tomorrowDate.getTime() + (19 * 60 * 60 * 1000));
    
    request(getURL(tomorrowDate), function (error, response, body) {
	if (!error) {
	    sendPinController(JSON.parse(body), tomorrowDate);
	}
    });
}

function getURL(selectedDate) {
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

function getDateObj (game, selectedDate) {
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

    console.log(givenTime);
    var newDate = new Date(dateString + 'T' + givenTime + '-0' + offset + '00');
	
    return newDate;
}

function getStatus (game) {
    if (game.linescore && game.status.ind !== 'PW' && game.status.ind !== 'P') {
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

function sendPregamePin (game, selectedDate) {
    var gameDate = getDateObj(game, selectedDate);
    console.log(gameDate.toString());
	
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
		    'type': 'genericReminder',
		    'tinyIcon': 'system://images/TIMELINE_BASEBALL',
		    'title': game.away_name_abbrev + ' @ ' + game.home_name_abbrev
		}
	    }
	]
    });

    return pin;
}

function sendOverPin (game, selectedDate) {
    var gameDate = getDateObj(game, selectedDate);
    console.log(gameDate.toString());
    
    var homeScore = game.linescore.r.home;
    var awayScore = game.linescore.r.away;
    var titleText = game.away_name_abbrev + ': ' + awayScore + ' - ' +
	game.home_name_abbrev + ': ' + homeScore;
    var extras = parseFloat(game.status.inning) > 9 ? '/' + game.status.inning : '';
    titleText = titleText + ' (F' + extras + ')';

    var winner = game.winning_pitcher;
    var loser = game.losing_pitcher;
    var saver = game.save_pitcher;
    var pitchers = [winner, loser, saver];

    for (var pitcherI in pitchers) {
	var pitcher = pitchers[pitcherI];
	pitcher.pStats = pitcher.wins + '-' + pitcher.losses + ', ' + pitcher.era;
    }
    
    var gameText = 'W: ' + winner.name_display_roster + ' (' + winner.pStats + ')\nL: ' + loser.name_display_roster + ' (' + loser.pStats + ')';
    if (saver.name !== '') {
	gameText = gameText + '\nS: ' + saver.name_display_roster + ' (' + saver.pStats + ')';
    }
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'-'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': titleText,
            'nameAway': game.away_name_abbrev,
            'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
            'sportsGameState': 'in-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL'
	},
	createNotification: {
	    layout: {
		time: new Date(),
		type: 'genericNotification',
		tinyIcon: 'system://images/TIMELINE_BASEBALL',
		title: titleText,
		body: gameText
	    }
	}
    });

    return pin;
}

function sendInProgressPin (game, selectedDate) {
    var gameDate = getDateObj(game, selectedDate);
        console.log(gameDate.toString());
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'_'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': game.away_name_abbrev + ' @ ' + game.home_name_abbrev,
	    'subtitle': game.status.inning_state + ' ' + game.status.inning,
	    'nameAway': game.away_name_abbrev,
            'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
	    'scoreAway': game.linescore.r.away,
	    'scoreHome': game.linescore.r.home,
	    'sportsGameState': 'in-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL'
	}
    });

    return pin;
}

function sendPinController (body, selectedDate) {

    // Keeps a record, indexed by game id (with /'s, not _'s)
    try {
	var jsonObj = jsonfile.readFileSync(datafile);
    }
    catch (err) {
	var jsonObj = {};
    }
	
    if (jsonObj === null) {
	jsonObj = {};
    }
    var dayObj = {};
    var games = body.data.games.game;
    var pinList = [];
    for (var i in games) {
	var game = games[i];
	var gameStatus = getStatus(game);
	if (gameStatus === 'Not Started') {
	    pin = (game, selectedDate);
	}
	else if (gameStatus === 'Over') {
	    pin = sendOverPin(game, selectedDate);
	}
	else if (gameStatus === 'In Progress') {
	    pin = sendInProgressPin(game, selectedDate);
	}

	dayObj[game.id] = {
	    pin: pin,
	    date: new Date(),
	    status: gameStatus,
	    gameId: game.id,
	    subscriptions: [game.away_name_abbrev, game.home_name_abbrev]
	};
    }
    
    for (var gameI in dayObj) {
	var pinObj = dayObj[gameI];

	sendPin(pinObj, jsonObj, selectedDate);
	var day = jsonObj[selectedDate.getDate()];
	if (day) {
	    if (day[pinObj.id]) {
		var writtenGame = day[pinObj.id];

		if (!(writtenGame.status === 'Over' && game.status === 'Over')) {
		    sendPin(pinObj, jsonObj, selectedDate);
		}
	    }
	}
	else {
	    sendPin(pinObj, jsonObj, selectedDate);
	}
    }
    
    jsonObj[selectedDate.getDate()] = dayObj;
    console.log(JSON.stringify(jsonObj, null, 4));
    jsonfile.writeFileSync(datafile, jsonObj);
}

function sendPin (pinObj, jsonObj, selectedDate)  {
    /*timeline.sendUserPin(pinObj.subscriptions, pinObj.pin, function (err) {
	if (err) {
            return console.error(err);
        }
        else {
            var gameId = pinObj.gameId;
	    var day = jsonObj[selectedDate.getDate()];
            if (!day) {
                jsonObj[selectedDate.getDate()] = {
                    gameId: pinObj
                }
            }
	    else {
		day[gameId] = pinObj;
	    }
            console.log('Pin sent successfully: ' + pinObj.subscriptions[0] + ' @ ' + pinObj.subscriptions[1] + ' (' + pinObj.status + ')');
        }
    });*/

    var gameId = pinObj.gameId;
    var day = jsonObj[selectedDate.getDate()];
    if (!day) {
        jsonObj[selectedDate.getDate()] = {
            gameId: pinObj
        }
    }
    else {
        day[pinObj.id] = pinObj;
    }
    // console.log('Pin sent successfully: ' + pinObj.subscriptions[0] + ' @ ' + pinObj.subscriptions[1] + ' (' + pinObj.status + ')');
    // console.log(gameId);
}

main();
