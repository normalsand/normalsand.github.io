<?php

// Stolen from StackOverflow :)
function is_assoc( array $arr ) {

  if ( array() === $arr ) return false;
  return array_keys( $arr ) !== range( 0, count( $arr ) - 1 );

}

// Does additional stuff (i.e. creating questions) when mode is switched
function switch_mode( int $index, array &$json_obj ) {

  switch ( $index ) {

  case 1:

    foreach ( $json_obj[ 'players' ] as $player ) {

      array_push( $json_obj[ 'question_stack' ], array( 'question' => 'How many holes in a polo?', 'name' => $player[ 'name' ] ) );

    }

    break;

  }

}

// Read data from POST request
$data = $_POST[ 'data' ];
$location = $_POST[ 'location' ];
$mode = $_POST[ 'mode' ];

// Initialize object to eventually to file
$json_obj = json_decode( file_get_contents( 'server.json' ), true );

// Check if the server is activated
// (Activation sets mode to not be -1; this step
// is required for accepting any other requests)
$is_activated = $json_obj[ 'mode' ] != -1;



// Check if trying to activate
if ( $mode == 'activate' && $data == 'secretbup' && !$is_activated ) {

  // Activate since code is correct
  $json_obj[ 'mode' ] = 0;

}

// If activated, allow reset
else if ( $mode == 'reset' && $is_activated ) {

  // Reset data (as if lobby was just created)
  $json_obj = '
  {
    "mode": -1,
    "players": [],
    "leader": "",
    "question_stack": [],
    "question_pool": [],
    "answer_stack": [],
    "answer_pool": []
  }';

  // Turn into object
  $json_obj = json_decode( $json_obj );

}

// Otherwise must parse through location
else if ( $is_activated ) {

  // This next segment of code parses through the container.element syntax
  // in $location to get a reference to the desired location
  $buffer_str = explode( '.', $location );
  $buffer_obj = &$json_obj;

  while ( $location != '' && count( $buffer_str ) > 0 ) {
    $buffer_obj = &$buffer_obj[ $buffer_str[0] ];
    array_splice( $buffer_str, 0, 1 );
  }

  // Data can be preceded with 'REAL|' to have the string interpreted
  // as an actual JSON object
  if ( substr( $data, 0, 5 ) == 'REAL|' ) {
    $data = json_decode( substr( $data, 5 ) );
  }

  if ( $mode == 'append' ) {

    // Append to an object
    array_push( $buffer_obj, $data );

  } else if ( $mode == 'set' ) {

    // Overwrite variable
    $buffer_obj = $data;

    // Do extra stuff if switching modes
    if ( $location == 'mode' ) {
      switch_mode( $data, $json_obj );
    }

  } else if ( $mode == 'delete' ) {

    // Delete variable (only reorder if not associative)
    if ( is_assoc( $buffer_obj ) ) {
      unset( $buffer_obj[ $data ] );
    } else {
      unset( $buffer_obj[ $data ] );
      $buffer_obj = array_values( $buffer_obj );
    }
  }

}

// Turn back into a string and write to file
$json_obj = json_encode( $json_obj );
$myfile = fopen( 'server.json', 'w' );
fwrite( $myfile, $json_obj );
fclose( $myfile );

?>