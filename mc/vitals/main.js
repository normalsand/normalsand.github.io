// Root directory for post requests
const ONLINE = true;
const URL = ONLINE ? 'https://normalsand-game-1.herokuapp.com/' : 'localhost:8001/';
const g_url_params = new URLSearchParams( window.location.search );

// Stores the player's color and data about their health
// You can add players not listed here through URL parameters
const PLAYERS = define_players();

// Stored alphebetically (ignoring periods)
const USERNAMES = Object.keys( PLAYERS ).sort( ( a, b ) => a.replace( /\./g, '' ) > b.replace( /\./g, '' ) );

// Keeps track of data points
// Cannot exceed `MAX_POINTS` in length
// Functions like a queue, items are popped off the front and pushed onto the back
const MAX_POINTS = 80;
let g_update_interval = 1;
let g_points = [];

// Glocal chart object
let g_graph = null;

// For window load
function load()
{
    // Attempt to update the graph every second
    // Only updates if it's divisible by `g_update_interval`;
    setInterval( attempt_update, 1000 );

    // Initally set the points
    define_points( g_update_interval, MAX_POINTS );

    // Create the chart
    let my_chart = document.querySelector( '#my_chart' ).getContext( '2d' );
    g_graph = new Chart( my_chart, {
        type: 'line',
        data:
        {
            datasets: function()
            {
                let output = [];

                for ( let username of USERNAMES )
                    output.push(
                    {
                        label: username,
                        data: [],
                        borderColor: PLAYERS[ username ].color,
                        cubicInterpolationMode: 'monotone',
                        pointStyle: context => determine_style( context, PLAYERS[ username ] ),
                        radius: 40
                    } );

                return output;
            }(),
        },
        options: {
            scales: {
                x: {
                    display: false
                },
                y: {
                    min: 0,
                    max: 20,
                    ticks: {
                        stepSize: 1
                    },
                    offset: true
                }
            },
            layout: {
                padding: {
                    top: 1
                }
            },
            animation: {
                duration: 1
            }
        }
    } );
}

window.onload = load;

// Initially creates the players
// Uses a pre-defined object as well as URL paremeters
function define_players()
{
    let output = {
        'MacroPixel': new Player( '#ffcf4a' ),
        'caidenthestriker': new Player( '#78fffd' ),
        'ReverseSphinx94': new Player( '#ff5252' ),
        'Goose5481': new Player( '#4340ff' ),
        'Blueshark129': new Player( '#d175ff' ),
        'toBezeerb': new Player( '#ff75df' ),
        '.M81119': new Player( '#1f9c30' ),
        'moe0727': new Player( '#ffaa3b' )
    };

    // Add new players from url
    for ( let param of g_url_params.entries() )    
    {
        if ( param[0].substring( 0, 3 ) == 'pl_' )
        {
            let player_name = param[0].substring( 3, 999 );
            let info = param[1].split( 'AND' );
            let color = info[0];

            output[ player_name ] = new Player( color );
        }
    }

    return output;
}

// Loads points prior to the present moment into memory
function define_points( step, limit )
{
    // Timestamp could be updated in the stem of the for loop, but it would be harder to read
    let timestamp = get_timestamp() - 1;
    for ( let i = 0; i < limit; i ++ )
    {
        // Add the points at the current timestamp to the list
        query_healths( function( data )
        {
            // Add to the list at correct index
            g_points.push( data );
            g_points.sort( ( a, b ) => ( a[ '$timestamp' ] > b[ '$timestamp' ] ) );

        }, timestamp );

        timestamp -= step;
    }
}

// Runs once a second
function attempt_update()
{
    // Get the current unix timestamp (used for querying)
    let timestamp = get_timestamp();

    // Only update healths if timestamp is a multiple of `g_update_interval`
    if ( timestamp % g_update_interval == 0 )
        update_healths( timestamp );
}

// Queries a dictionary of health data from the server and executes a callback on it
function query_healths( callback, timestamp )
{
    // Get the data from the server
    load_file( `${ URL }mc/vitals?time=${ timestamp }`, function ( text )
    {
        // Load into JSON and correct death to be undefined value
        data = JSON.parse( text );

        // If the file returned nothing, copy the data from before
        if ( data === null )
            data = g_points[ g_points.length - 1 ];

        // Add label & timestamp to data
        data[ '$label' ] = timestamp;
        data[ '$timestamp' ] = timestamp;

        // Execute the callback using the data
        callback( data );
    } );
}

// Queries the current health data, forwarding it to `update_graph()`
function update_healths( timestamp )
{
    query_healths( function( data )
    {
        // Add to queue, removing an item if it exceeds space limit
        g_points.push( data );
        if ( g_points.length >= MAX_POINTS )
            g_points.splice( 0, g_points.length - MAX_POINTS );

        // Finally, match the graph to the current data
        update_graph( g_graph, g_points );
    }, timestamp );
}

// Updates the graph
function update_graph( graph, data )
{
    // Reinitialize the labels
    g_graph.data.labels = data.map( element => element[ '$label' ] );

    // For every dataset under the graph
    for ( let dataset of g_graph.data.datasets )
    {
        // Re-initialize dataset from points
        let temp_data = [];
        for ( let i = 0; i < data.length; i ++ )
        {
            // Get point under this player name
            let point = data[i][ dataset.label ];

            // Leave at 0 if first death point, otherwise set to undefined
            if ( point == 0 )
            {
                if ( ( data[ i - 1 ] === undefined ) || ( data[ i - 1 ][ dataset.label ] <= 0 ) )
                    point = undefined;
            }

            temp_data.push( point );
        }

        dataset.data = temp_data;
    }

    graph.update();
}

// Determines the radius of a point
// 0 unless the graph is discontinuous to the right
function determine_style( context, player )
{
    // Point data
    let index = context.dataIndex;
    let dataset = context.dataset.data;

    // console.log( index, dataset[ index ], dataset[ index + 1 ] );

    // Circle if no point to the left AND not first point
    if ( index != 0 && dataset[ index - 1 ] === undefined )
        return player.icons.circle;

    // Ring if not point to the right AND not dead AND not last point
    if ( index != dataset.length - 1 && dataset[ index ] > 0 && dataset[ index + 1 ] === undefined )
        return player.icons.ring;

    // X if point is death
    if ( dataset[ index ] == 0 )
        return player.icons.x;

    // No image otherwise
    return player.icons.empty;
}

// Define player class
function Player( color )
{
    this.color = color;
    this.icons = generate_player_icons( color );
}

// 
function generate_player_icons( color )
{
    // DEATH ICON (x)
    const WIDTH = 30;
    const FACTOR = WIDTH / 100;

    let x_icon = document.createElement( 'canvas' );
    x_icon.width = x_icon.height = 100 * FACTOR;
    ctx = x_icon.getContext( '2d' );
    ctx.lineWidth = 20 * FACTOR;
    ctx.strokeStyle = color;
    ctx.moveTo( 25 * FACTOR, 25 * FACTOR );
    ctx.lineTo( 75 * FACTOR, 75 * FACTOR );
    ctx.moveTo( 25 * FACTOR, 75 * FACTOR );
    ctx.lineTo( 75 * FACTOR, 25 * FACTOR );
    ctx.stroke();

    // START ICON (filled circle)
    let circle_icon = document.createElement( 'canvas' );
    circle_icon.width = circle_icon.height = 100 * FACTOR;
    ctx = circle_icon.getContext( '2d' );
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc( 50 * FACTOR, 50 * FACTOR, 25 * FACTOR, 0, 2 * Math.PI )
    ctx.fill();

    // DISCONNECT ICON (filled circle)
    let ring_icon = document.createElement( 'canvas' );
    ring_icon.width = ring_icon.height = 100 * FACTOR;
    ctx = ring_icon.getContext( '2d' );
    ctx.lineWidth = 15 * FACTOR;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc( 50 * FACTOR, 50 * FACTOR, 22.5 * FACTOR, 0, 2 * Math.PI )
    ctx.stroke();

    // EMPTY ICON
    let empty = document.createElement( 'canvas' );
    empty.width = empty.height = 1

    return { x: x_icon, circle: circle_icon, ring: ring_icon, empty: empty };
}

function get_timestamp()
{
    // Get the current unix timestamp (used for querying)
    // Gives it 1.5 seconds of leeway to process the data
    let timestamp = Math.floor( new Date().getTime() / 1000 - 1.5 );

    // Subtract 1 in case it's still processing for this second
    return timestamp;
}