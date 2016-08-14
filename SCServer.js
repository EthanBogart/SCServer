// Cool stuff goes here

var Timeline = require('pebble-api').Timeline;
var schedule = require('node-schedule');
var request = require('request');
var selectedDate = new Date();

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

        var day = date[2].toString();
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
		printGames(JSON.parse(body));
	}
});

function printGames(body) {

	var games = body.data.games.game;
	for (var i in games) {
		var game = games[i];
		console.log(game.away_name_abbrev + ' @ ' + game.home_name_abbrev + ' -- ' + getDateObj(game).toISOString());
	}

}

