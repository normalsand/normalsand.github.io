// Retrieves data from external source
function load_file( url, callback, auth = false )
{
    let request = new XMLHttpRequest();
    request.open( 'GET', url, true );

    if ( auth )
        request.setRequestHeader( 'Authorization', 'Bearer mt0dgHmLJMVQhvjpNXDyA83vA_PxH23Y' );
    
    request.onload = e =>
    {
        if ( request.readyState === 4 )
        {
            if ( request.status === 200 )
                callback( request.responseText );
            else
                console.error( request.statusText );
        }
    };
    request.onerror = e =>
    {
        console.error( request.statusText );
    };
    request.send( null );
}