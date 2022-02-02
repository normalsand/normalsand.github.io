// Changing the 'online' variable switches between using a localhost
// or using the online web server
const online = false
const ip = ( online ? 'wss://normalsand-game-1.herokuapp.com' : 'ws://localhost:8001' );

// More strict version of parseInt() (kinda stolen from mozilla web docs)
function filterInt( value )
  { return ( /^-?\d+$/.test( value ) ) ? Number( value ) : NaN; }

// More strict version of parseFloat() (I made this one myself :D)
function filterFloat( value )
  { return ( /^-?(\d+|\.\d+|\d+\.\d+)$/.test( value ) ) ? Number( value ) : NaN; }

// Prints to console/alerts client
function log( str )
  { console.error( str ); }

// Main websocket
const ws = new WebSocket( ip );

ws.addEventListener( 'open', () => {
  console.log( `Connected to ${ ip }` );
} );

// Called every time the server sends something back
ws.addEventListener( 'message', input => {

  input = input.data;

  // Split at spaces NOT preceded by a hyphen
  let data = input.split( /(?<!-) /g );

  // Replace '- ' with ' ' and '--' with '-'
  for ( let i = 0; i < data.length; i ++ )
    data[i] = data[i].replace( /--/g, '-' ).replace( /- /g, ' ' );

  // Attempt to parse the resultant array & run its function
  try {

    if ( !COMMANDS || !COMMAND_FUNCTIONS )
      throw Error( 'COMMANDS and COMMAND_FUNCTIONS must be defined' );

    let cmd_data = parse_command( data, COMMANDS );
    COMMAND_FUNCTIONS[ cmd_data.index ]( cmd_data.body );

  }
  catch ( err ) { log( err.message ); }

} );

// Sends a command to be received by the client
// Must be sent into the function as an array or string
function send( data ) {

  if ( Array.isArray( data ) ) {

    // Merge the array into a string separated by " "
    // Any actual spaces in the data are replaced by "- "
    // And any individual "-" is replaced with "--"
    let output = '';
    data.forEach( s => { output += s.replace( / /g, '- ' ).replace( /-/g, '--' ) + ' '; } );
    output = output.slice( 0, -1 ); // Remove trailing space

    ws.send( output );
  }

  else if ( typeof data === 'string' || data instanceof String ) {

    // Simply pass the same string to the server
    let output = data;

    ws.send( output );

  }

  else throw Error( 'ERROR: Data must be passed into send() as an array or string!' );

}

// Initially set up command templates based on list passed into it
function setup_commands( cmd_list ) {

  let output = [];

  // For every command string...
  cmd_list.forEach( cmd => {

    // For every token within each command string
    let sub_output = [];
    cmd.split( ' ' ).forEach( token => {

      // Append string argument
      if ( token[0] == '*' )
        sub_output.push( { data: token.substr( 1, 999 ), type: 'arg' } );

      // Append int argument
      else if ( token.substr( 0, 2 ) == 'i*' )
        sub_output.push( { data: token.substr( 2, 999 ), type: 'int arg' } );

      // Append float argument
      else if ( token.substr( 0, 2 ) == 'f*' )
        sub_output.push( { data: token.substr( 2, 999 ), type: 'float arg' } );

      // Append keyword
      else
        sub_output.push( { data: token, type: 'keyword' } );

    } );
    output.push( sub_output );

  } );

  return output;

}

// This function takes a command and tries to match it to
// the already-existing command templates passed in as an array
// If it can find a match, it parses the command into an array with
// the relevant data as well as the index of the command template it matched
// If it can't find a match or encounters a different error, it throws an exception
function parse_command( cmd, templates ) {

  // cmd should be inputted as an array
  if ( !Array.isArray( cmd ) )
    throw Error( '"cmd" must be an array!' );

  // temp_indices holds the index of all the templates
  // As templates are ruled out, these indices are popped off the stack
  let temp_indices = [];
  for ( let i = 0; i < templates.length; i ++ )
    temp_indices.push( i );

  // Cycle through every token in the array
  // This is done with a FOR loop so I can use array indices
  for ( let i = 0; i < cmd.length; i ++ )
  {

    let token = cmd[i];

    // Rule out any template with a keyword that doesn't match the current command
    let to_delete = []; // Store array elements to delete after iteration is over
    temp_indices.forEach( ii => {
      
      // Mark index of template as invalid if it doesn't have enough arguments
      if ( templates[ii].length <= i )
        to_delete.push( ii );

      // Mark index of template as invalid if argument doesn't match keyword
      else if ( templates[ii][i].type == 'keyword' && token != templates[ii][i].data )
        to_delete.push( ii );

      // Mark index of template as invalid if argument can't resolve to int arg
      else if ( templates[ii][i].type == 'int arg' && isNaN( filterInt( token ) ) )
        to_delete.push( ii );

      // Mark index of template as invalid if argument can't resolve to float arg
      else if ( templates[ii][i].type == 'float arg' && isNaN( filterFloat( token ) ) )
        to_delete.push( ii );

    } );
    to_delete.forEach( ii => temp_indices.splice( temp_indices.indexOf( ii ), 1 ) );

    // If no templates are left, then throw an error
    if ( temp_indices.length == 0 )
      throw Error( `> ${ cmd.join( ' ' ) }\nNo match for argument ${ token }` );

  }

  // If there are multiple templates left, then throw an error
  if ( temp_indices.length > 1 )
      throw Error( `> ${ cmd.join( ' ' ) }\nToo many matches for current arguments` );

  let template = templates[ temp_indices[0] ]; // Only 1 index remaining

  // If the template has a different argument count, then throw an error
  if ( template.length != cmd.length )
    throw Error( `> ${ cmd.join( ' ' ) }\nOne or multiple arguments missing` );

  // If all of these checks passed, we should be good to send the data back as an array
  let output = {};
  for ( let i = 0; i < cmd.length; i ++ ) {

    if ( template[i].type == 'int arg' )
      output[ template[i].data ] = filterInt( cmd[i] );
    else if ( template[i].type == 'float arg' )
      output[ template[i].data ] = filterFloat( cmd[i] );
    else if ( template[i].type == 'arg' )
      output[ template[i].data ] = cmd[i];

  }

  // Return the array data/command index
  return { body: output, index: temp_indices[0] };

}