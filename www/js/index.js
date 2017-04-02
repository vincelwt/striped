function stripeRequest(url, callback) {
	
	if (!window.localStorage.getItem('apiKey')) return callback('noapikey');
	
    var request = new XMLHttpRequest();
    request.open('GET', url, true);

    request.onload = function () {
        if (this.status >= 200 && this.status < 400) {
            var data = JSON.parse(this.response);
            callback(null, data);
        } else {
        	console.error(this.status)
   			callback('error');
        }
    };

    request.onerror = function (e) {
    	console.log(e);
        callback('error');
    };

    request.setRequestHeader("Authorization", 'Bearer '+window.localStorage.getItem('apiKey'));

    request.send();
}

function updateData(callback) {
	if (!window.localStorage.getItem("data")) document.getElementById('spinner').classList.remove('hide');
    stripeRequest("https://api.stripe.com/v1/charges?limit=100", function(error, data) {
    	document.getElementById('spinner').classList.add('hide');

		callback();

		if (error == 'noapikey') return openSettings();
		if (error == 'error') return window.plugins.toast.showLongBottom('Error fetching data, check your credentials and your internet connection');
        
		window.localStorage.setItem("data", JSON.stringify(data.data));
	
        updateList();
    })
}

function updateList() {
	if (!window.localStorage.getItem("data")) return;
	
	var data = JSON.parse(window.localStorage.getItem("data"));
	
	document.getElementById('listTransaction').innerHTML = "";
        
	paymentsHistory = [];

	for (row of data) {
		var recentClass='';
		if (moment(row.created*1000).isAfter(lastUsed)) {
			var recentClass=' recent';
		}
		
		var el = `
			<div class="row`+recentClass+`" onclick="seeDetails('`+encodeURIComponent(JSON.stringify(row))+`')">
					<img src='img/`+row.status+`.png'/>
					<span class='status'>Payment `+row.status+`</span>
					<span class='currency'>`+row.currency+`</span>
					<span class='amount'>`+row.amount/100+`</span>
					<span class='amountDec'>.`+parseFloat(row.amount/100).toFixed(2).toString().slice(-2)+`</span>
					<span class='date'>`+moment(row.created*1000).calendar()+`</span>
			</div>
			`

		document.getElementById('listTransaction').insertAdjacentHTML('beforeend', el);

		var day = moment(row.created*1000).format('DD/MM/YYYY');

		if (row.status === 'succeeded') {

			if (paymentsHistory.some(function(o){return o["day"] === day;})) {

				for (d of paymentsHistory) {
					if (d.day === day) d.amount += row.amount;
				}

			} else {
				paymentsHistory.push({'day': day, 'amount': row.amount});
			}
		}

	}

	paymentsHistory.sort(function(a,b) {return (a.day > b.day) ? 1 : ((b.day > a.day) ? -1 : 0);} ); 

	updateTimeperiod();
}

function updateTimeperiod() {
	var earned = 0;
	
	var period = parseInt(document.getElementById('timeperiod').value);
	window.localStorage.setItem("period", period);
	
	lastWeek = [];
	for (var i = (period-1); i >= 0; i--) {
		var day = moment().subtract(i, 'days').format('DD/MM/YYYY');
		lastWeek.push(day);
	}

	var series = [];
	for (d of lastWeek) {
		var amount = 0;
		for (h of paymentsHistory) {
			if (d === h.day) amount = h.amount/100;
		}
		
		earned += amount;
		series.push(amount);
	}
	
	document.getElementById('earnings').innerHTML = earned;

	myChart.data.labels = new Array(series.length);
	myChart.data.datasets[0].data = series;
	myChart.update();
}

function openSettings() {
	modal = new tingle.modal({
		footer: true,
		closeLabel: "Close",
		cssClass: ['settingsModal'],
		onOpen: function() {
			if (window.localStorage.getItem('apiKey')) document.getElementById('apiKey').value = window.localStorage.getItem('apiKey');
			
		},
		onClose: function() {
			window.localStorage.setItem('apiKey', document.getElementById('apiKey').value);
			updateData(function(){});
		},
		beforeClose: function() {
			return true;
		}
	});

	modal.setContent(`

		<p>Your API key is needed to access your data from Stripe. All data is fetched directly from Stripe's servers.</p>

		<h3>Your Stripe API key</h3>
		<input type='text' id='apiKey' placeholder='sk_live_*'/>

	`);

	modal.addFooterBtn('Save', 'tingle-btn tingle-btn--primary', function() {
		modal.close();
	});

	modal.open();

}

function seeDetails(row) {
	
	var row = JSON.parse(decodeURIComponent(row));
	
	modal = new tingle.modal({
		footer: false,
		closeLabel: "Close",
		onOpen: function() {
	
		},
		onClose: function() {
	
		},
		beforeClose: function() {
			return true;
		}
	});

	modal.setContent(`

		<h3>Payment details:</h3>
		
		<p><b>Amount:</b> `+parseFloat(row.amount/100).toFixed(2)+' '+row.currency+`</p>

		<b>Description:</b>
		<p>`+(row.description ? row.description : 'No description')+`</p>

		<b>Customer:</b>
		<p>`+row.customer+`</p>
		<p>`+row.source.name+`</p>

		<p><b>Risk level:</b> `+row.outcome.risk_level+`</p>
	`);

	modal.open();
}

var ctx = document.getElementById("myChart");

var myChart = new Chart(ctx, {
	type: 'line',
	data: {
		labels:  new Array(7),
		datasets: [{
			lineTension: 0,
			backgroundColor: "rgba(75,192,192,0)",
			borderColor: "white",
			pointBorderColor: "rgba(75,192,192,1)",
			pointBackgroundColor: "#e7f5ff",
			data: [0,0,0,0,0,0,0],
			pointRadius: 0
		}]
	},
	options: {
		responsive: true,
		maintainAspectRatio: false,
		scales: {
			xAxes: [{
			
				display: false
			}],
			yAxes: [{
				display: false,
				ticks: {
					autoSkip: true,
				    maxTicksLimit: 4
				}
			}]
		},
		legend: {
			display: false
		 },
		 tooltips: {
			enabled: false
		 }
	}
});

function onLoad() {
    document.addEventListener("deviceready", onDeviceReady, false);
}

function onDeviceReady() {
    document.addEventListener("backbutton", onBackKeyDown, false);
}

function onBackKeyDown() {
	modal.close();
}

document.getElementById('timeperiod').value = (window.localStorage.getItem("period") ? window.localStorage.getItem("period") : '15');

var lastUsed = (window.localStorage.getItem("lastUsed") ? window.localStorage.getItem("lastUsed") : moment().format())
window.localStorage.setItem("lastUsed", moment().format());

updateList();

updateData(function(){});

PullToRefresh.init({
  mainElement: '#listTransaction',
  onRefresh: function(done){ updateData(done); }
});


