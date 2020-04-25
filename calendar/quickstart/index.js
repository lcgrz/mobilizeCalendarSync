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
  var {data} = await getMobilizeEvents();

  var events = [];
  events.push(_.first(data.data));

  console.log('events', events);

  _.forEach(events, (event) => {
    destructureEvent(event, auth);
  });
}



function destructureEvent(event, auth) {
  _.forEach(event.timeslots, (timeslot) => {
    var start_date = new Date(timeslot.start_date * 1000);
    var end_date = new Date(timeslot.end_date * 1000);
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
      location = venue;
    }
    else {
      location = (venue ? `${venue}, ` : '') +
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


    createEvent(auth, flattenedEvent);
  });
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
  });
  // .then(res => {
  //     //console.log('googleEvent', res.data);
  //     return res;
  // })
  // .catch(err => console.log('there was an error', err));
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

async function getMobilizeEvents() {
  return axios.get('https://api.mobilize.us/v1/organizations/2529/events?timeslot_start=gte_now');
}

async function createEvent(auth, mobilizeEvent) {
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
    // 'organizer': {
    //   'email': string,
    //   'displayName': string,
    // }  
  };

  //console.log(event);
  var {data} = await getGoogleEvent(auth, event.id);
  console.log('googleEvent', data);
  return;
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });
  
}
// [END calendar_quickstart]

module.exports = {
  SCOPES,
  listEvents: listGoogleEvents,
};
