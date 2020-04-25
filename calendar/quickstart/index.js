/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// [START calendar_quickstart]
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
const MAX_RESULTS = 1;

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) {
    return console.log('Error loading client secret file:', err);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), insertMobilizeEvents);
});

async function insertMobilizeEvents(auth) {
  console.log('insertMobilizeEvents');
  var events = await getMobilizeEvents();
  console.log('events', events);

  _.forEach(events, (event) => {
    console.log(event.title);
    if(!(event.title.toLowerCase().includes('maine') || event.title.toLowerCase().includes('susan collins'))) {
      return;
    }
    _.forEach(event.timeslots, (timeslot) => {
      var flattenedEvent = getDestructuredEvent(event, timeslot);
      //console.log('flattenedEvent', flattenedEvent);

      createOrUpdateGoogleEvent(auth, flattenedEvent);
    });
  });
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
      else {
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
    console.log('flattenedEvent', flattenedEvent);

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
      if (err) return console.error('Error retrieving access token', err);
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
    calendarId: 'primary',
    eventId: eventId
  })
  .then((response) => {
    //console.log('getGoogleEvent', response);
    return response.data;
  });
}
/**
 * Lists the next MAX_RESULTS events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listGoogleEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
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

async function getMobilizeEvents(index) {
  return axios.get('https://api.mobilize.us/v1/organizations/2529/events?timeslot_start=gte_now')
          .then((response) => {
              if(typeof index !== 'undefined') {
                return [response.data.data[index]];
              } else {
                return response.data.data;
              }
          });
}

async function createOrUpdateGoogleEvent(auth, mobilizeEvent) {
  var event = createGoogleEvent(mobilizeEvent);


  try {
    var data = await getGoogleEvent(auth, event.id);
    console.log('getGoogleEvent', data);

    if(data.extendedProperties.modified_date != event.modified_date) {     
      var updatedEvent = updateGoogleEvent(auth, event);
      console.log('updatedEvent', updatedEvent);
    } else {
      console.log(`Event ${event.id} has not changed.`)
    }
  } catch(error) {
    //console.log(`Error retrieving event ${event.id}.`, response);
    console.log('error', `${error.response.status}: ${error.response.statusText}`);

    if(error.response.status == 404) {
      console.log(' Inserting new event...');
      var insertedEvent = await insertGoogleEvent(auth, event);
      console.log('insertedEvent', insertedEvent);
    } else {
      // do an update here if the modified_date is different that that on the extendedProperties
      console.log('And unknown error occurred: ', error.response);
    }
  }
}

function createGoogleEvent(mobilizeEvent) {
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

  //console.log(event);

  return event;
}

async function updateGoogleEvent(auth, event) {
  const calendar = google.calendar({ version: 'v3', auth });
  return calendar.events.update({
    auth: auth,
    calendarId: 'primary',
    resource: event,
  })
  .then((response) => { 
    console.log('update response'); 
    return response.data;
  });
}

module.exports = {
  SCOPES,
  listEvents: listGoogleEvents,
};
async function insertGoogleEvent(auth, event) {
  const calendar = google.calendar({ version: 'v3', auth });
  return calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    resource: event,
  })
  .then((response) => {return response.data});
}

