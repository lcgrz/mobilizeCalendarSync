const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const _ = require('lodash');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
const MAX_RESULTS = 10;
const CALENDAR_ID = 'ssip82dtd0kvm9nrmc9qvmsae0@group.calendar.google.com';

// Load client secrets from a local file.
(async() => {
fs.readFile('credentials.json', (err, content) => {
  if (err) {
    return console.log('Error loading client secret file:', err);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listGoogleEvents);
});
})();

async function insertMobilizeEvents(auth) {

  var mobilizeUrl = 'https://api.mobilize.us/v1/organizations/2529/events?timeslot_start=gte_now';
  var events = await getAllMobilizeEvents(mobilizeUrl, events);
  var eventCount = 0;
  var shiftCount = 0;

  console.log('events from caller', events.length);
  
  for(let event of events)
  {
    if(!(event.title.toLowerCase().includes('maine') || event.title.toLowerCase().includes('susan collins'))) {
      continue;
    }
    console.log(`${event.id}: ${event.title}`);
    for(let timeslot of event.timeslots) {
      setTimeout(() => {
        var flattenedEvent = getDestructuredEvent(event, timeslot);
        createOrUpdateGoogleEvent(auth, flattenedEvent);
      }, 1000 * shiftCount);

      shiftCount++;
    };
    eventCount++;
  }

  console.log(`Added ${eventCount} events with a total of ${shiftCount} shifts`)
}

function getDestructuredEvent(event, timeslot) {
    var start_date = new Date(timeslot.start_date * 1000);
    var end_date = new Date(timeslot.end_date * 1000);
    var created_date = new Date(event.created_date * 1000);
    var modified_date = new Date(event.modified_date * 1000);

    var { venue, address_lines, locality, region, country, postal_code } = event.location || {};
    var address = '';
    if (address_lines && address_lines.length) {
      if (address_lines.length > 1 && address_lines[1].length) {
        address = _.join(address_lines, ' ');
      }
      else if(!address_lines[0].includes('private')){
        address = address_lines[0];
      }
    }

    var location = '';
    if (venue.includes('private')) {
      location = (venue && !venue.includes('private') ? `${venue}, ` : '') +
        (address ? `${address}, ` : '') +
        (locality ? `${locality}, ` : '') +
        (region ? `${region} ` : '') +
        (postal_code ? `${postal_code}, ` : '') +
        (country ? `${country}` : '');
    }

    var flattenedEvent = {
      'id': event.id,
      'title': event.title,
      'summary': event.summary,
      'description': event.description,
      'created_date': created_date.toISOString(),
      'modified_date': modified_date.toISOString(),
      'organization_id': event.sponsor.id,
      'organization_name': event.sponsor.name,
      'timeslot_id': timeslot.id,
      'start_date': start_date.toISOString(),
      'end_date': end_date.toISOString(),
      'location': location,
      'timezone': event.timezone,
      'event_type': event.event_type,
      'browser_url': event.browser_url,
      'contact': event.contact
    };
    //console.log('flattenedEvent', flattenedEvent);

    return flattenedEvent;
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      return getAccessToken(oAuth2Client, callback);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return console.error('Error retrieving access token', err);
      }
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

async function getGoogleEvent(auth, eventId) {
  const calendar = google.calendar({version: 'v3', auth});
  return calendar.events.get({
    calendarId: CALENDAR_ID,
    eventId: eventId
  })
  .then((response) => {
    //console.log('getGoogleEvent', response);
    return response.data;
  });
}
/**
 * Lists the next MAX_RESULTS events on the user's calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listGoogleEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: (new Date()).toISOString(),
    maxResults: MAX_RESULTS,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;``
    if (events.length) {
      console.log(`Upcoming ${MAX_RESULTS} events:`);
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log('event', event);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}

async function getMobilizeEvents(url) {
  return axios.get(url);
}

async function getAllMobilizeEvents(url, index) {  
  var response = await getMobilizeEvents(url);

  if(typeof index !== 'undefined') {
    return response.data.data[index];
  } else {
    console.log(`${response.data.data.length} events returned`);
    if(response.data.next) {
      return response.data.data.concat(await getAllMobilizeEvents(response.data.next));
    } else {
      return response.data.data;
    }
  }

}

async function createOrUpdateGoogleEvent(auth, mobilizeEvent) {
  var newEvent = mapToGoogleEvent(mobilizeEvent);

  try {
    var existingGoogleEvent = await getGoogleEvent(auth, newEvent.id);
    //console.log('mobilizeEvent', mobilizeEvent);
    //console.log('existingGoogleEvent', existingGoogleEvent);
    //console.log(`Updated: ${event.id}: ${event.summary}`);
    //console.log(`Existing: ${existingGoogleEvent.id}: ${existingGoogleEvent.summary}`);

    console.log(`Mobilize last modified date: |${newEvent.extendedProperties.private.modified_date}`);
    console.log(`Google last modified date: |${existingGoogleEvent.extendedProperties.private.modified_date}`);
    //console.log('googleEvent', googleEvent);

    //if(existingGoogleEvent.extendedProperties.private.modified_date != newEvent.extendedProperties.private.modified_date) { 
    if(true) {
      console.log('Event changed. Updating event...');  
      var updatedGoogleEvent = await updateGoogleEvent(auth, newEvent);
      console.log('updatedGoogleEvent', updatedGoogleEvent);
    } else {
      console.log(`Event ${newEvent.id} has not changed.`)
    }
  } catch(error) {
    //console.log(`Error retrieving event ${event.id}.`, response);
    //console.log('error', `${error.response.status}: ${error.response.statusText}`);

    if(error.response && error.response.status === 404) {
      console.log('Event not found. Inserting new event...');
      var insertedGoogleEvent = await insertGoogleEvent(auth, newEvent);
      console.log('insertedGoogleEvent', insertedGoogleEvent);
    } else {
      // do an update here if the modified_date is different that that on the extendedProperties
      console.log('An unknown error occurred: ', error);
    }
  }
  return;
}

function mapToGoogleEvent(mobilizeEvent) {
  var event = {
    'id': `eid${mobilizeEvent.id}tsid${mobilizeEvent.timeslot_id}`,
    'summary': mobilizeEvent.title,
    'location': mobilizeEvent.location,
    'description': mobilizeEvent.description,
    'start': {
      'dateTime': mobilizeEvent.start_date,
      'timeZone': mobilizeEvent.timezone,
    },
    'end': {
      'dateTime': mobilizeEvent.end_date,
      'timeZone': mobilizeEvent.timezone,
    },
    'recurrence': [],
    'attendees': [],
    'reminders': {
      'useDefault': false,
      'overrides': [],
    },
    'source': {
      'title': mobilizeEvent.title,
      'url': mobilizeEvent.browser_url
    },
    'extendedProperties': {
      'private': {
        'source': 'Mobilize',
        'created_date': mobilizeEvent.created_date,
        'modified_date': mobilizeEvent.modified_date
      }
    }
  };

  //console.log('createGoogleEvent', event);

  return event;
}

async function updateGoogleEvent(auth, event) {
  console.log(`Event ID: ${event.id}`);
  const calendar = google.calendar({ version: 'v3', auth });
  return calendar.events.update({
    auth: auth,
    calendarId: CALENDAR_ID,
    eventId: event.id,
    resource: event,
  })
  .then((response) => { return response.data; });
}

module.exports = {
  SCOPES,
  listEvents: listGoogleEvents,
};

async function insertGoogleEvent(auth, event) {
  const calendar = google.calendar({ version: 'v3', auth });
  return calendar.events.insert({
    auth: auth,
    calendarId: CALENDAR_ID,
    resource: event,
  })
  .then((response) => {return response.data});
}

