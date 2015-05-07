/*
	0.2.2
*/
var SleepStateAgent = function (name, id, config) {
	SleepStateAgent._ip = null;
	var self = this;

	var topicPrefix = "sleepstate/v1/";

	_init = function() {
		// Set default value for optional arguments
		self._name = (name === undefined) ? location.host : name;
		self._id = (id === undefined) ? _generateGUID() : id;

		// Create a default config object and append standard values
		self._config = (config === undefined) ? ({}) : config;
		self._config.name = self._name;
		self._config.id = self._id;

		self._client = null;
		self._clientId = null;

		_getIP(function(ip) {
			self._clientId = self._name+":"+SleepStateAgent._ip+":"+self._id;

			// Create a client instance
			self._client = new Paho.MQTT.Client("test.mosquitto.org", 8080, self._clientId);		

			self._client.onConnectionLost = _onConnectionLost;
			self._client.onMessageArrived = _onMessageArrived;

			// Connect the client, set last will
			self._client.connect({onSuccess: _onConnected, willMessage:_lastWillMessage()});

			console.info("SleepState Agent %s initialised", self._clientId);
		});
	}

	_onConnected = function(message) {
		console.info("SleepState Agent %s connected", self._clientId);
		// Once a connection has been made, make a subscription and send a message.
		self._client.subscribe(topicPrefix+SleepStateAgent._ip+"/agents");
		self._client.subscribe(topicPrefix+SleepStateAgent._ip+"/agents/"+self._name);
		self._client.subscribe(topicPrefix+SleepStateAgent._ip+"/agents/"+self._name+"/"+self._id);

		// Set agent config, to allow discovery
		self._client.send(_configMessage());
	}

	_onConnectionLost = function(responseObject) {
		if (responseObject.errorCode !== 0) {
			console.info("SleepState Agent %s lost connection - %s", self._clientId, responseObject.errorMessage);
		}
	}

	_onMessageArrived = function(message) {
		try {
			command = JSON.parse(message.payloadString);
		} catch(e) {
			console.error("SleepState Agent %s received an message which isnt a command - %s", self._clientId, message.payloadString);
			return;
		}

		if( command.name == "sleep") {
			if(self.onSleep != null) {
				console.info("SleepState Agent %s received a sleep command", self._clientId);

				// Trigger Sleep
				var response = self.onSleep();

				// Respond with Metadata, if requested/provided commanderId
				if(response != null && command.commanderId != null) {
					self._client.send(_metadataMessage(command.commanderId, response));
					console.info("SleepState Agent %s responded with - %o", self._clientId, response);
				}

			}
			else {
				console.warn("SleepState Agent %s has no sleep callback", self._clientId);
			}
		}
		else {
			console.error("SleepState Agent %s received an unknown command - %s", self._clientId, message.payloadString);
		}
	}

	_lastWillMessage = function() {
		var lastWillMessage = new Paho.MQTT.Message("");
		lastWillMessage.qos = 2;
		lastWillMessage.retained = true;
		lastWillMessage.destinationName = topicPrefix+SleepStateAgent._ip+"/agents/"+self._name+"/"+self._id+"/config";

		return lastWillMessage;
	}

	_configMessage = function() {
		var configMessage = new Paho.MQTT.Message(JSON.stringify(self._config));
		configMessage.qos = 2;
		configMessage.retained = true;
		configMessage.destinationName = topicPrefix+SleepStateAgent._ip+"/agents/"+self._name+"/"+self._id+"/config";

		return configMessage;
	}

	_metadataMessage = function(commanderId, response) {
		response.agentName = self._name;
		response.agentId = self._id;

		var metaDataMessage = new Paho.MQTT.Message(JSON.stringify(response));
		metaDataMessage.qos = 2;
		metaDataMessage.retained = false;
		metaDataMessage.destinationName = topicPrefix+SleepStateAgent._ip+"/commanders/"+command.commanderId;

		return metaDataMessage;
	}

	// Get IP address asynchronously and cache for future use
	_getIP = function(callback) {
		//Check if we already know our IP address as its static
		if(SleepStateAgent._ip == null) {
			var xhr = new XMLHttpRequest(),IP_ADDRESS;
			xhr.onreadystatechange = function() {
			    if (xhr.readyState == 4 && xhr.status == 200) {
			        SleepStateAgent._ip = JSON.parse(xhr.responseText).ip;
			        callback(SleepStateAgent._ip);
			    }
			}
			xhr.open('GET', 'http://jsonip.com/', true);
			xhr.send();
		}
		else {
			callback(SleepStateAgent._ip);
		}
	}

	// GUID like generator for ClientId
	// Taken from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
	_generateGUID = function() {
	  function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	  }
	  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}

	_init();
};