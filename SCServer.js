// Cool stuff goes here
var devToken = 'SBj6klq15kt13tl2lvg13neyuvssr866';
var prodToken = 'l3tob6zd7x4el7svcfk33v7jxahq61z7';
var Timeline = require('pebble-api').Timeline;
var timeline = new Timeline({
    apiKey: prodToken
});
var schedule = require('node-schedule');
var jsonfile = require('jsonfile');
var datafile = 'data.json';
var request = require('request');

console.log('This is the server (tm)');

function main() {
    schedule.scheduleJob('*/1 * * * *', function () {
	runCycle();
    });
    schedule.scheduleJob('* */6 * * *', function () {
	runTomorrowCycle();
    });

    schedule.scheduleJob('* */6 * * *', function () {
	runTwoDaysFromNowCycle();
    });
}

function runCycle () {
    var selectedDate = new Date();
    selectedDate.setTime(selectedDate.getTime() - (10 * 60 * 60 * 1000));
    
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

function runTwoDaysFromNowCycle () {
    var twoDaysFromNow = new Date();
    twoDaysFromNow.setTime(twoDaysFromNow.getTime() + (43 * 60 * 60 * 1000));
    
    request(getURL(twoDaysFromNow), function (error, response, body) {
	if (!error) {
	    sendPinController(JSON.parse(body), twoDaysFromNow);
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

    var hpp = game.home_probable_pitcher;
    var app = game.away_probable_pitcher;
    var pitchers = [hpp, app];

    for (var pitcherI in pitchers) {
	var pitcher = pitchers[pitcherI];
	pitcher.pStats = pitcher.wins + '-' + pitcher.losses + ', ' + pitcher.era;
	pitcher.name = pitcher.first + ' ' + pitcher.last;
    }

    var bodyText = 'HP: ' + hpp.name + '\n (' + hpp.pStats + ')\n' + 'AP: ' + app.name + '\n (' + app.pStats + ')';
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'-'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': game.away_name_abbrev + ' at ' + game.home_name_abbrev,
            'nameAway': game.away_name_abbrev,
	    'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
            'sportsGameState': 'pre-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL',
	    'body': bodyText 
	},
	reminders: [
	    {
		'time': gameDate,
		'layout': {
		    'type': 'genericReminder',
		    'tinyIcon': 'system://images/TIMELINE_BASEBALL',
		    'title': game.away_name_abbrev + ' at ' + game.home_name_abbrev
		}
	    }
	]
    });

    return pin;
}

function sendOverPin (game, selectedDate) {
    var gameDate = getDateObj(game, selectedDate);

    var homeScore = game.linescore.r.home;
    var awayScore = game.linescore.r.away;
    var titleText = game.away_name_abbrev + ': ' + awayScore + ' - ' +
	game.home_name_abbrev + ': ' + homeScore;
    var extras = parseFloat(game.status.inning) > 9 ? '/' + game.status.inning : '';
    titleText = titleText + ' (F' + extras + ')';

    var winner = game.winning_pitcher;
    var loser = game.losing_pitcher;
    var saver = game.save_pitcher;
    var pitchers = [winner, loser];

    for (var pitcherI in pitchers) {
	var pitcher = pitchers[pitcherI];
	pitcher.pStats = pitcher.wins + '-' + pitcher.losses + ', ' + pitcher.era;
    }
    
    var gameText = 'W: ' + winner.name_display_roster + '\nL: ' + loser.name_display_roster;
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
	updateNotification: {
	    time: new Date(),
	    layout: {
		type: 'genericNotification',
		tinyIcon: 'system://images/TIMELINE_BASEBALL',
		title: titleText,
		body: gameText
	    }
	}
    });

    // console.log(JSON.stringify(pin, null, 4));
    
    return pin;
}

function sendInProgressPin (game, selectedDate) {
    var gameDate = getDateObj(game, selectedDate);
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'_'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': game.away_name_abbrev + ' at ' + game.home_name_abbrev,
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

    // Erases games from 2 days ago
    var oldDate = new Date();
    oldDate.setTime(selectedDate.getTime() - (2 * 24 * 60 * 60 * 1000));

    var oldDay = oldDate.getDate();
    if (jsonObj[oldDay]) {
	jsonObj[oldDay] = null;
    }
    
    var dayObj = {};
    var games = body.data.games.game;
    var pinList = [];
    for (var i in games) {
	var game = games[i];
	var gameStatus = getStatus(game);
	if (gameStatus === 'Not Started') {
	    pin = sendPregamePin(game, selectedDate);
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

	var day = jsonObj[selectedDate.getDate()];
	if (day) {
	    if (day[pinObj.gameId]) {
		var writtenGame = day[pinObj.gameId];
		if ((pinObj.status === 'Over' && writtenGame.status !== 'Over') || pinObj.status !== 'Over') {
		    sendPin(pinObj, jsonObj, selectedDate);
		}
	    }
	}
	else {
	    sendPin(pinObj, jsonObj, selectedDate);
	}
    }
    
    jsonObj[selectedDate.getDate()] = dayObj;
    jsonfile.writeFileSync(datafile, jsonObj);
}

function sendPin (pinObj, jsonObj, selectedDate)  {
    timeline.sendSharedPin(pinObj.subscriptions, pinObj.pin, function (err) {
	if (err) {
            console.log(err);
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
            console.log('Pin sent successfully: ' + pinObj.subscriptions[0] + ' @ ' + pinObj.subscriptions[1] + ' (' + pinObj.status + ') -- ' + (new Date()).toISOString());
        }
    });
}

main();
