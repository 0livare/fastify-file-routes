## url comment

Add a --comment/-c flag that adds a comment of the full URL above the partial one that's included in the code. Read the prefix from the root server file to determine what the full path is instead of assuming /API.

## root server file

Add a --root/-r flag that allows the user to specify which file is their root server file that we should read the route prefix from. When that flag is not passed the default assumptions should be:

1. Src /server
2. Src/main
3. Src/index
   in that order.

## fix pathless layout bug

There's currently a bug where the URL put in the file contains the name of the subdirectory that the file is in. This functionality is incorrect and also shows an inherent flaw in the way that the tests are currently written. This is core functionality of the tool and should have been caught a long time ago.
