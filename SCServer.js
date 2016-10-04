// Cool stuff goes here
var schedule = require('node-schedule');
var jsonfile = require('jsonfile');
var datafile = 'data.json';
var request = require('request');

// Pulls keys from json file
try {
    var keys = jsonfile.readFileSync('tokens.json');
    var devToken = keys.devToken;
    var prodToken = keys.prodToken;
    var Timeline = require('pebble-api').Timeline;
    var timeline = new Timeline({
	apiKey: prodToken
    });

    main();
}
catch (err) {
    console.log(err);
    console.log('You do not have the proper keys to send pins to the app.\nIf you wish to try using the client, put your keys in a json file called "tokens.json"');
}

console.log('This is the server (tm)');
console.log('Started at ' + (new Date()).toISOString());

function main() {
    runTomorrowCycle();
    runTwoDaysFromNowCycle();

    schedule.scheduleJob('*/1 * * * *', function () {
	console.log('run');
	runCycle();
    });
    schedule.scheduleJob('0 */6 * * *', function () {
	console.log('tomorrow');
	runTomorrowCycle();
    });
    schedule.scheduleJob('0 */6 * * *', function () {
	console.log('two days');
	runTwoDaysFromNowCycle();
    });
}

function runCycle () {
    var selectedDate = new Date();
    selectedDate.setTime(selectedDate.getTime() - (10 * 60 * 60 * 1000));

    if (areGamesOver(selectedDate)) {
	console.log('Games are recorded as over for ' + selectedDate.toDateString() + ', no more pins to send -- ' + selectedDate.toISOString());
    }
    else {
        request(getURL(selectedDate), function (error, response, body) {
            if (!error) {
		try {
                    sendPinController(JSON.parse(JSON.stringify(body)), selectedDate, new Date());
		}
		catch (err) {
		    console.log(err);
		}
            }
        });
    }
}

function runTomorrowCycle () {
    var tomorrowDate = new Date();
    tomorrowDate.setTime(tomorrowDate.getTime() + (14 * 60 * 60 * 1000));

    request(getURL(tomorrowDate), function (error, response, body) {
        if (!error) {
	    try {
		sendPinController(JSON.parse(JSON.stringify(body)), tomorrowDate, new Date());
	    }
	    catch (err) {
		console.log(err);
	    }
        }
    });
}

function runTwoDaysFromNowCycle () {
    var twoDaysFromNow = new Date();
    twoDaysFromNow.setTime(twoDaysFromNow.getTime() + (38 * 60 * 60 * 1000));

    request(getURL(twoDaysFromNow), function (error, response, body) {
        if (!error) {
	    try {
		sendPinController(JSON.parse(JSON.stringify(body)), twoDaysFromNow, new Date());
	    }
	    catch (err) {
		console.log(err);
	    }
        }
    });
}

function getURL(newDate) {
    var date = [];
    date.push(newDate.getFullYear());
    date.push(newDate.getMonth() + 1);
    date.push(newDate.getDate());

    // Month is given from 0-11
    var month = (date[1]).toString();
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

    var timeSpl = game.time_date_aw_lg.split(' ');
    var givenTime = timeSpl[1];
    var timeSpl = givenTime.split(':');
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
    if ((game.linescore && game.status.ind !== 'PW' && game.status.ind !== 'P') || (game.status && game.status.reason)) {
	if (game.status.status === 'Game Over' || game.status.status === 'Final' || game.status.status === 'Completed Early') {
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

function sendPregamePin (game, selectedDate, runDate) {
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
        id: game.id.replace(/\//g,'_'),
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
	    'primaryColor': '#FFFFFF',
	    'backgroundColor': '#0055AA',
	    'body': bodyText,
	    'lastUpdated': runDate
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

function sendOverPin (game, selectedDate, runDate) {
    var gameDate = getDateObj(game, selectedDate);

    var homeScore = game.linescore.r.home;
    var awayScore = game.linescore.r.away;
    var titleText = game.away_name_abbrev + ': ' + awayScore + '\n' +
	game.home_name_abbrev + ': ' + homeScore;
    var noteTitleText = game.away_name_abbrev + ': ' + awayScore + ' - ' +
	game.home_name_abbrev + ': ' + homeScore;
    var extras = parseFloat(game.status.inning) > 9 ? '/' + game.status.inning : '';
    var subtitleText = '(Final' + extras + ')';
    noteTitleText = noteTitleText + ' (F' + extras + ')';

    var winner = game.winning_pitcher;
    var loser = game.losing_pitcher;
    var saver = game.save_pitcher;
    var pitchers = [winner, loser];

    for (var pitcherI in pitchers) {
	var pitcher = pitchers[pitcherI];
	pitcher.pStats = pitcher.wins + '-' + pitcher.losses + ', ' + pitcher.era;
    }
    
    var gameText = 'W: ' + winner.name_display_roster + '\nL: ' + loser.name_display_roster;
    if (saver.name) {
	gameText = gameText + '\nS: ' + saver.name_display_roster + ' (' + saver.pStats + ')';
    }
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'_'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': titleText,
	    'subtitle': subtitleText,
            'nameAway': game.away_name_abbrev,
            'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
	    'scoreAway': game.linescore.r.away,
	    'scoreHome': game.linescore.r.home,
            'sportsGameState': 'in-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL',
	    'body': gameText,
	    'primaryColor': '#FFFFFF',
	    'backgroundColor': '#0055AA',
	    'lastUpdated': runDate
	},
	updateNotification: {
	    time: new Date(),
	    layout: {
		type: 'genericNotification',
		tinyIcon: 'system://images/TIMELINE_BASEBALL',
		title: noteTitleText,
		body: gameText
	    }
	}
    });

    // console.log(JSON.stringify(pin, null, 4));
    
    return pin;
}

function sendInProgressPin (game, selectedDate, runDate) {
    var gameDate = getDateObj(game, selectedDate);
    
    var pin = new Timeline.Pin({
        id: game.id.replace(/\//g,'_'),
        time: gameDate,
        layout: {
            'type': 'sportsPin',
            'title': game.away_name_abbrev + ': ' + game.linescore.r.away + '\n' + game.home_name_abbrev  + ': ' + game.linescore.r.home,
	    'subtitle': game.status.inning_state + ' ' + game.status.inning,
	    'nameAway': game.away_name_abbrev,
            'nameHome': game.home_name_abbrev,
            'recordAway': game.away_win + '/' + game.away_loss,
            'recordHome': game.home_win + '/' + game.home_loss,
	    'scoreAway': game.linescore.r.away,
	    'scoreHome': game.linescore.r.home,
	    'sportsGameState': 'in-game',
            'tinyIcon': 'system://images/TIMELINE_BASEBALL',
            'largeIcon': 'system://images/TIMELINE_BASEBALL',
	    'primaryColor': '#FFFFFF',
	    'backgroundColor': '#0055AA',
	    'lastUpdated': runDate
	}
    });

    return pin;
}

function sendPinController (body, selectedDate, runDate) {

    // Keeps a record, indexed by game id (with /'s, not _'s)
    try {
	var jsonObj = jsonfile.readFileSync(datafile);
    }
    catch (err) {
	var jsonObj = {};
    }
    
    // Erases games from 4 days ago
    var oldDate = new Date();
    oldDate.setTime(selectedDate.getTime() - (4 * 24 * 60 * 60 * 1000));

    var oldDay = oldDate.getDate();
    if (jsonObj[oldDay]) {
	jsonObj[oldDay] = null;
    }
    
    var dayObj = {};

    var games = JSON.parse(body).data.games.game;

    // For some reason, games not given as array if there is only one
    if (!Array.isArray(games)) {
	games = [games];
    }

    for (var i in games) {
        var game = games[i];
        var gameStatus = getStatus(game);
        var pin;
        if (gameStatus === 'Not Started') {
            pin = sendPregamePin(game, selectedDate, runDate);
        }
        else if (gameStatus === 'Over') {
            pin = sendOverPin(game, selectedDate, runDate);
        }
        else if (gameStatus === 'In Progress') {
            pin = sendInProgressPin(game, selectedDate, runDate);
        }

	// Determine whether playoff game
	var subscriptions = [game.away_name_abbrev, game.home_name_abbrev];
	if (typeof game.series !== 'undefined') {
	    subscriptions.push('playoffs');
	}

	if (pin) {
            dayObj[game.id] = {
                pin: pin,
                date: new Date(),
                status: gameStatus,
                gameId: game.id,
                subscriptions: subscriptions
            };
	}
    }

    for (var gameI in dayObj) {
	var pinObj = dayObj[gameI];

	var day = selectedDate.getDate();
	if (jsonObj[day]) {
	    if (jsonObj[day][pinObj.gameId]) {
		var writtenGame = jsonObj[day][pinObj.gameId];
		if ((pinObj.status === 'Over' && writtenGame.status !== 'Over') || (pinObj.status !== 'Over' && pinObj.status !== 'Halted')) {
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
	    var day = selectedDate.getDate();
	    console.log('Pin sent successfully: ' + pinObj.subscriptions[0] + ' @ ' + pinObj.subscriptions[1] + ' (' + pinObj.status + ') -- ' + (new Date()).toISOString());
	    if (!jsonObj[day]) {
                jsonObj[day] = {
                    gameId: pinObj
                }
            }
	    else {
		jsonObj[day][gameId] = pinObj;
	    }
        }
    });
}

function areGamesOver (selectedDate) {
    try {
	var jsonObj = jsonfile.readFileSync(datafile);
    }
    catch (err) {
	return false;
    }

    var day = selectedDate.getDate();
    if (jsonObj[day]) {
	
	for (var gameI in jsonObj[day]) {    
	    var game = jsonObj[day][gameI];

	    if (game.status !== 'Over') {
		return false;
	    }
	}
    }
    else {
	return false;
    }

    return true;
}
